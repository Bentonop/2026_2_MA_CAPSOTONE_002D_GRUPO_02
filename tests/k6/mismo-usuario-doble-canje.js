import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

/**
 * ESCENARIO B: MISMO USUARIO / MÚLTIPLES CANJES SIMULTÁNEOS (DOBLE GASTO / DOBLE RESERVA)
 * ---------------------------------------------------------------------------------------
 * Simula a un mismo alumno (o varios pestañas/dispositivos de la misma cuenta)
 * intentando canjear o reservar la misma clase (o agotar 1 crédito) al mismo instante.
 *
 * Resultado esperado:
 *  - Máximo 1 reserva exitosa (201).
 *  - El resto (N - 1) rechazadas con 409 Conflict (RESERVA_DUPLICADA o SIN_CREDITOS).
 *  - Cero errores 500 o bloqueos muertos (deadlocks).
 */

const reservasExitosasUsuario = new Counter('mismo_usuario_reservas_exitosas');
const rechazosControlados = new Counter('mismo_usuario_rechazos_controlados');
const erroresServidor = new Counter('mismo_usuario_errores_servidor');
const latenciaCanjeMs = new Trend('latencia_canje_mismo_usuario_ms', true);

const API_URL = __ENV.API_URL || 'http://localhost:3000/api/reservas';
const CLASS_ID = Number(__ENV.CLASS_ID || 1);
const TARGET_USER_ID = __ENV.TARGET_USER_ID || 'c0000000-0000-0000-0000-000000000003';
const INTENTOS_SIMULTANEOS = Number(__ENV.VUS_MISMO_USUARIO || 30);

export const options = {
  scenarios: {
    doble_canje_mismo_usuario: {
      executor: 'per-vu-iterations',
      vus: INTENTOS_SIMULTANEOS, // 30 peticiones paralelas con la MISMA cuenta
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    // Regla crítica: un mismo usuario NO puede reservar 2 veces la misma clase ni duplicar canje
    mismo_usuario_reservas_exitosas: ['count<=1'],
    mismo_usuario_errores_servidor: ['count==0'],
  },
};

export default function () {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (__ENV.API_TOKEN) {
    headers['Authorization'] = `Bearer ${__ENV.API_TOKEN}`;
  }
  if (__ENV.LOAD_TEST_KEY) {
    headers['x-load-test-key'] = __ENV.LOAD_TEST_KEY;
  }

  const payload = JSON.stringify({
    classId: CLASS_ID,
    userId: TARGET_USER_ID, // Todas las VUs usan EXACTAMENTE el mismo usuario
  });

  const inicio = Date.now();
  const res = http.post(API_URL, payload, { headers, timeout: '15s' });
  const duracion = Date.now() - inicio;
  latenciaCanjeMs.add(duracion);

  let bodyJson = {};
  try {
    bodyJson = res.json() || {};
  } catch (_) {}

  if (res.status === 200 || res.status === 201) {
    reservasExitosasUsuario.add(1);
    console.log(
      `[PRIMER CANJE ACEPTADO] Petición #${__VU} en ${duracion}ms | ` +
      `id_reserva=${bodyJson.id_reserva ?? 'N/A'} | creditos_restantes=${bodyJson.creditos_restantes ?? '?'}`
    );
  } else if (res.status === 409 || res.status === 400) {
    rechazosControlados.add(1);
  } else {
    erroresServidor.add(1);
    console.error(`[ERROR] Petición #${__VU} | HTTP ${res.status} | ${duracion}ms | ${res.body}`);
  }

  check(res, {
    'sin doble reserva ni error 5xx': (r) => [200, 201, 400, 409].includes(r.status),
  });
}
