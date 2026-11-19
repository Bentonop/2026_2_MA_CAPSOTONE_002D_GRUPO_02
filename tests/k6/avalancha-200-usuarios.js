import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

/**
 * ESCENARIO A: AVALANCHA DE 200 USUARIOS SIMULTÁNEOS POR LA MISMA CLASE
 * -------------------------------------------------------------------
 * Mide:
 *  - Condición de carrera (anti-overbooking <= CUPO_MAXIMO, en Cuerpo y Alma = 8).
 *  - Qué usuarios logran reservar primero (orden de llegada y timestamp).
 *  - Latencia bajo contención (p95, p99, max, tiempo de espera en lock FOR UPDATE).
 *  - Errores 5xx o timeouts (atasco de connection pool o deadlocks).
 */

const reservasExitosas = new Counter('reservas_exitosas');
const rechazadasPorCupo = new Counter('rechazadas_por_cupo');
const rechazadasDuplicadoOCredito = new Counter('rechazadas_duplicado_o_sin_creditos');
const erroresServidorOBloqueo = new Counter('errores_servidor_o_bloqueo');
const latenciaReservaMs = new Trend('latencia_reserva_ms', true);

const CUPO_MAXIMO = Number(__ENV.CUPO_MAXIMO || 8);
const API_URL = __ENV.API_URL || 'http://localhost:3000/api/reservas';
const CLASS_ID = Number(__ENV.CLASS_ID || 1);

// Opcional: lista JSON de UUIDs reales en env USER_IDS='["uuid1","uuid2",...]'
// o lista de tokens JWT en env USER_TOKENS='["jwt1","jwt2",...]'
const USER_IDS = __ENV.USER_IDS ? JSON.parse(__ENV.USER_IDS) : null;
const USER_TOKENS = __ENV.USER_TOKENS ? JSON.parse(__ENV.USER_TOKENS) : null;

export const options = {
  scenarios: {
    avalancha_200_usuarios: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.VUS || 200), // 200 usuarios simultáneos
      iterations: 1,                  // 1 intento al mismo instante por usuario
      maxDuration: '45s',
    },
  },
  thresholds: {
    // Latencia: el 95% de las 200 peticiones concurrentes debe responder bajo 2 segundos
    http_req_duration: ['p(95)<2000'],
    // Integridad anti-overbooking: NUNCA pueden pasar más reservas que CUPO_MAXIMO
    reservas_exitosas: [`count<=${CUPO_MAXIMO}`],
    // Estabilidad: cero errores 500/502/504 ni timeouts (indicaría deadlock o caída de pool)
    errores_servidor_o_bloqueo: ['count==0'],
  },
};

export default function () {
  const vuIndex = __VU - 1;
  const userId = USER_IDS
    ? USER_IDS[vuIndex % USER_IDS.length]
    : `00000000-0000-4000-8000-${String(__VU).padStart(12, '0')}`;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (USER_TOKENS && USER_TOKENS.length > 0) {
    headers['Authorization'] = `Bearer ${USER_TOKENS[vuIndex % USER_TOKENS.length]}`;
  } else if (__ENV.API_TOKEN) {
    headers['Authorization'] = `Bearer ${__ENV.API_TOKEN}`;
  }

  if (__ENV.LOAD_TEST_KEY) {
    headers['x-load-test-key'] = __ENV.LOAD_TEST_KEY;
  }

  const payload = JSON.stringify({
    classId: CLASS_ID,
    userId: userId,
  });

  const inicio = Date.now();
  const res = http.post(API_URL, payload, { headers, timeout: '15s' });
  const duracion = Date.now() - inicio;
  latenciaReservaMs.add(duracion);

  let bodyJson = {};
  try {
    bodyJson = res.json() || {};
  } catch (_) {}

  if (res.status === 200 || res.status === 201) {
    reservasExitosas.add(1);
    console.log(
      `[GANADOR] VU #${__VU} (user=${userId}) reservó en ${duracion}ms | ` +
      `id_reserva=${bodyJson.id_reserva ?? 'N/A'} | cupos=${bodyJson.cupos_inscritos ?? '?'}/${CUPO_MAXIMO} | ts=${new Date().toISOString()}`
    );
  } else if (res.status === 409 || res.status === 400) {
    if (bodyJson.codigo === 'CUPO_AGOTADO') {
      rechazadasPorCupo.add(1);
    } else if (bodyJson.codigo === 'RESERVA_DUPLICADA' || bodyJson.codigo === 'SIN_CREDITOS') {
      rechazadasDuplicadoOCredito.add(1);
    } else {
      rechazadasPorCupo.add(1);
    }
  } else {
    erroresServidorOBloqueo.add(1);
    console.error(
      `[ATASCO/FALLO] VU #${__VU} | HTTP ${res.status} | ${duracion}ms | body=${String(res.body).slice(0, 180)}`
    );
  }

  check(res, {
    'respuesta controlada (200/201 o 409/400)': (r) => [200, 201, 400, 409].includes(r.status),
    'latencia individual < 5000ms': () => duracion < 5000,
  });
}
