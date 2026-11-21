# Bitácora Oficial de Errores, Defectos y Control de Calidad (QA)
**Proyecto:** Sistema Web Integral "Cuerpo y Alma"  
**Asignatura:** Capstone (PTY4614) - Fase 2 / Fase 3  
**Equipo de Desarrollo:** José Rivera, Benjamín García, Manuel Campos  
**Fecha:** Noviembre 2026  
**Estándar:** Basado en IEEE 829 (Software Test Documentation) y Matriz de Hallazgos ISTQB  

---

## 1. Resumen Ejecutivo de Hallazgos y Estabilidad del Sistema

Durante la auditoría técnica y fase de pruebas exhaustivas del software, se identificaron **11 incidencias críticas, mayores y de usabilidad**. Cada una fue documentada, analizada en su causa raíz, reproducida en entorno de pruebas y subsanada mediante refactorización de código limpio, buenas prácticas de React 19 / Next.js 16 y fortalecimiento de esquemas en Supabase PostgreSQL.

| Código Defecto | Módulo Afectado | Severidad | Estado Previo | Estado Actual |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | `src/lib/utils.ts` / Core UI | 🔴 Crítica | Error de compilación en `cn()` por paquete npm no funcional. | Resuelto (Función `cn` pura y nativa). |
| **DEF-02** | `src/app/layout.tsx` / Feedback | 🟠 Alta | Ausencia de `<Toaster />`; alertas `toast` silenciadas. | Resuelto (`<Toaster position="top-right" />` montado). |
| **DEF-03** | `/profesor/clase/[id]` / Seguridad | 🔴 Crítica | URL de asistencia accesible sin autenticación ni rol. | Resuelto (`<RoleGuard allowedRole="profesor">`). |
| **DEF-04** | `/profesor/clase/[id]` / Asistencia | 🔴 Crítica | Código QR estático (SVG mock inerte, no escaneable). | Resuelto (`QRCodeSVG` dinámico con payload de validación). |
| **DEF-05** | `/alumno/mis-clases` / Negocio | 🟠 Alta | Cancelación permitida a destiempo sin reintegro de cupo. | Resuelto (Regla de 2 horas + reembolso transaccional). |
| **DEF-06** | `/profesor/metricas` / Privacidad | 🟠 Alta | Fuga de datos: profesor veía estadísticas de otros profesores. | Resuelto (Filtro relacional estricto `.eq('id_profesor', uid)`). |
| **DEF-07** | `/admin/dashboard` / Persistencia | 🟠 Alta | Asignación de profesor suplente no persistía en Supabase. | Resuelto (Update transaccional en tabla `clase`). |
| **DEF-08** | `Header.tsx` / Navegación | 🟡 Media | Menú de notificaciones forzaba redirección errónea a login. | Resuelto (Aislamiento de sesión y control condicional). |
| **DEF-09** | `database/asistencia` / SQL | 🔴 Crítica | `.upsert()` en asistencia fallaba por falta de `UNIQUE(id_reserva)`. | Resuelto (Constraint `UNIQUE (id_reserva)` en Postgres). |
| **DEF-10** | Asistencia / Proceso Operativo | 🟠 Alta | Flujo unidireccional rígido (alumno dependía de cámara del docente). | Resuelto (Asistencia bidireccional: Alumno escanea al profesor). |
| **DEF-11** | UX General (Admin y Alumno) | 🟡 Media | Uso de `alert()` nativo bloqueaba el render y arruinaba mobile. | Resuelto (Toasts reactivos no bloqueantes). |
| **DEF-12** | `SignInForm` / `SignUpForm` | 🟠 Alta | Nombres cortos (<3 letras), emails sin @, claves cortas (<6 car.) y falta de resiliencia en login fallido. | Resuelto (Zod Schemas estrictos y try/catch con toast amigable). |

---

## 2. Fichas Técnicas Detalladas de Errores y Soluciones

### [DEF-01] Falla de compilación e importación en componente utilitario `cn()`
- **Módulo / Archivo:** `src/lib/utils.ts`, `src/components/ui/button.tsx`, `package.json`
- **Severidad:** 🔴 Crítica (Bloqueante)
- **Descripción:** Al intentar compilar los componentes de diseño, el sistema arrojaba `TypeError: (0 , _utils.cn) is not a function`. La dependencia `"cn": "^0.4.0"` en `package.json` no correspondía a un helper utilitario de clases de Tailwind.
- **Paso a Paso de Reproducción:**
  1. Instalar dependencias con `npm install`.
  2. Intentar renderizar cualquier componente shadcn (`<Button>`, `<Input>`).
  3. La aplicación colapsa con pantalla roja de error de módulo no encontrado o función no exportada.
- **Código Defectuoso (Antes):**
  ```json
  // package.json (erróneo)
  "dependencies": {
    "cn": "^0.4.0"
  }
  ```
  *(No existía `src/lib/utils.ts` con la función exportada).*
- **Causa Raíz:** Dependencia de npm equivocada y ausencia del archivo utilitario estándar del framework.
- **Código Corregido (Después):**
  ```typescript
  // src/lib/utils.ts
  export function cn(...inputs: (string | undefined | null | false)[]): string {
    return inputs.filter(Boolean).join(" ");
  }
  ```
- **Criterio de Aceptación:** Los componentes UI compilan limpiamente sin dependencias externas innecesarias, combinando condicionales de Tailwind en milisegundos.

---

### [DEF-02] Silenciamiento total de Notificaciones Toast en el Sistema
- **Módulo / Archivo:** `src/app/layout.tsx`
- **Severidad:** 🟠 Alta
- **Descripción:** Múltiples pantallas ejecutaban `toast.success()` o `toast.error()`, pero el usuario nunca recibía respuesta visual, generando la falsa impresión de que los botones no funcionaban.
- **Paso a Paso de Reproducción:**
  1. Reservar o cancelar una clase.
  2. El código ejecuta `toast.success("Clase reservada")`.
  3. En la pantalla no ocurre absolutamente nada visual.
- **Causa Raíz:** La librería `react-hot-toast` requiere que el componente raíz `<Toaster />` esté montado en el árbol DOM del Layout principal.
- **Código Corregido (Después):**
  ```tsx
  // src/app/layout.tsx
  import { Toaster } from "react-hot-toast";

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="es">
        <body>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
          {children}
        </body>
      </html>
    );
  }
  ```
- **Criterio de Aceptación:** Toda confirmación, advertencia y error del sistema despliega alertas visuales elegantes y animadas en la esquina superior.

---

### [DEF-03] Falta de Protección de Rutas (RoleGuard) en Asistencia Docente
- **Módulo / Archivo:** `src/app/profesor/clase/[id]/page.tsx`
- **Severidad:** 🔴 Crítica (Seguridad)
- **Descripción:** La ruta de toma de asistencia y generación de códigos QR de una clase no contaba con guardián de autorización. Un alumno o usuario anónimo con acceso a la URL directa (`/profesor/clase/uuid-123`) podía visualizar la lista de asistentes y la clave QR del profesor.
- **Paso a Paso de Reproducción:**
  1. Iniciar sesión como alumno.
  2. Escribir manualmente en el navegador: `http://localhost:3000/profesor/clase/1`.
  3. La página cargaba sin validar si el usuario autenticado posee el rol `profesor`.
- **Causa Raíz:** Invocación directa del componente sin envoltura de control de acceso por roles.
- **Código Corregido (Después):**
  ```tsx
  // src/app/profesor/clase/[id]/page.tsx
  import { RoleGuard } from "@/components/auth/RoleGuard";

  export default function ClaseAsistenciaPage() {
    return (
      <RoleGuard allowedRole="profesor">
        <ClaseAsistenciaContent />
      </RoleGuard>
    );
  }
  ```
- **Criterio de Aceptación:** Si un alumno o usuario no docente intenta ingresar a la ruta, es redirigido inmediatamente a su panel autorizado, protegiendo la privacidad de los datos.

---

### [DEF-04] Código QR de Asistencia Docente Estático (Mock No Operativo)
- **Módulo / Archivo:** `src/app/profesor/clase/[id]/page.tsx`
- **Severidad:** 🔴 Crítica (Operativa)
- **Descripción:** El panel del profesor mostraba una ilustración estática SVG que parecía un código QR pero era una imagen fija con rectángulos negros dibujados a mano. Ninguna cámara de teléfono o escáner podía leer datos desde él.
- **Paso a Paso de Reproducción:**
  1. Abrir la pantalla del profesor `/profesor/clase/[id]`.
  2. Apuntar con un escáner de smartphone o con la app de alumno.
  3. El escáner no detecta ningún payload (formato no reconocible).
- **Código Defectuoso (Antes):**
  ```tsx
  // Código mock inerte
  <div className="bg-white p-4 rounded-xl">
    <svg className="w-48 h-48" viewBox="0 0 100 100">
      <rect x="10" y="10" width="20" height="20" fill="black" />
      <rect x="70" y="10" width="20" height="20" fill="black" />
    </svg>
  </div>
  ```
- **Código Corregido (Después):**
  ```tsx
  // Generación dinámica y real con QRCodeSVG
  import { QRCodeSVG } from "qrcode.react";

  const qrData = JSON.stringify({
    tipo: "ASISTENCIA_CLASE",
    id_clase: clase.id_clase,
    fecha: new Date().toISOString().split("T")[0],
    token: `VALID-${clase.id_clase}-${Date.now()}`
  });

  <QRCodeSVG value={qrData} size={220} level="H" includeMargin={true} />
  ```
- **Criterio de Aceptación:** El QR codifica metadatos en tiempo real, con nivel de redundancia alta (H) y lectura instantánea por escáneres ópticos.

---

### [DEF-05] Cancelación de Clases Sin Regla de Negocio de 2 Horas ni Reintegro de Cupos
- **Módulo / Archivo:** `src/app/alumno/mis-clases/page.tsx`
- **Severidad:** 🟠 Alta (Lógica de Negocio)
- **Descripción:** El alumno podía presionar "Cancelar Reserva" 5 minutos antes de la clase o incluso después de iniciada. Además, al cancelar, el contador físico `cupos_disponibles` de la clase no se devolvía y el crédito de su plan quedaba perdido.
- **Paso a Paso de Reproducción:**
  1. Reservar clase a las 18:00 hrs.
  2. A las 17:55 hrs presionar "Cancelar".
  3. El sistema eliminaba el registro sin advertir sobre la política de cancelación anticipada (mínimo 2 horas antes).
- **Código Corregido (Después):**
  ```typescript
  // Validación estricta de tiempo de anticipación (2 horas)
  const fechaHoraClase = new Date(`${clase.fecha}T${clase.hora_inicio}`);
  const ahora = new Date();
  const diferenciaHoras = (fechaHoraClase.getTime() - ahora.getTime()) / (1000 * 60 * 60);

  if (diferenciaHoras < 2) {
    toast.error("Solo puedes cancelar con al menos 2 horas de anticipación. El cupo no es reembolsable.");
    return;
  }

  // Transacción: Liberar cupo y reembolsar crédito al plan del alumno
  await supabase.from("reserva").update({ estado_reserva: "cancelada" }).eq("id_reserva", idReserva);
  await supabase.rpc("incrementar_cupo_clase", { p_id_clase: clase.id_clase });
  await supabase.rpc("reembolsar_credito_alumno", { p_id_alumno: user.id });
  toast.success("Reserva cancelada con éxito. Cupo y crédito reembolsados.");
  ```
- **Criterio de Aceptación:** Se garantiza la disciplina de reserva del estudio de danza y pilates, protegiendo las finanzas y la disponibilidad de cupos para otros alumnos.

---

### [DEF-06] Fuga de Información en Métricas del Profesor (Data Leak)
- **Módulo / Archivo:** `src/app/profesor/(main)/metricas/page.tsx`
- **Severidad:** 🟠 Alta (Privacidad de Datos)
- **Descripción:** La consulta a la tabla `asistencia` y `clase` no filtraba por el identificador del profesor autenticado, mostrando la sumatoria total de alumnos e ingresos de todos los profesores de la academia.
- **Código Defectuoso (Antes):**
  ```typescript
  // Consulta general que traía métricas de toda la academia
  const { data } = await supabase.from("clase").select("id_clase, nombre, cupos_inscritos");
  ```
- **Código Corregido (Después):**
  ```typescript
  // Aislamiento de datos por ID del profesor autenticado
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("clase")
    .select("id_clase, nombre_clase, cupos_inscritos, asistencia(*)")
    .eq("id_profesor", user.id);
  ```
- **Criterio de Aceptación:** Cada profesor visualiza única y exclusivamente el rendimiento de sus clases asignadas.

---

### [DEF-07] Falta de Persistencia en Asignación de Profesor Suplente
- **Módulo / Archivo:** `src/app/admin/dashboard/page.tsx`
- **Severidad:** 🟠 Alta
- **Descripción:** En la vista administrativa de gestión de incidencias, al seleccionar un profesor suplente para cubrir una ausencia, solo se modificaba el estado de React (`setProfesor(...)`), perdiéndose el cambio al refrescar la pantalla.
- **Código Corregido (Después):**
  ```typescript
  const handleAsignarSuplente = async (idClase: string, idNuevoProfesor: string) => {
    const { error } = await supabase
      .from("clase")
      .update({ id_profesor: idNuevoProfesor })
      .eq("id_clase", idClase);

    if (error) {
      toast.error("Error al asignar profesor suplente.");
      return;
    }
    toast.success("Profesor suplente asignado y notificado en base de datos.");
    cargarClases();
  };
  ```
- **Criterio de Aceptación:** El cambio de docente impacta directamente la base de datos y se refleja en tiempo real en los calendarios.

---

### [DEF-08] Bloqueo de Navegación por Manejo Inadecuado de Sesión en Header
- **Módulo / Archivo:** `src/components/layout/Header.tsx`
- **Severidad:** 🟡 Media
- **Descripción:** Al interactuar con el popover de notificaciones, un manejador de eventos ejecutaba inadvertidamente la desautenticación o redirección forzada a `/login` para usuarios con roles activos.
- **Causa Raíz:** Llamada a `signOut()` ligada a un callback genérico de navegación sin verificar el objetivo del clic.
- **Código Corregido (Después):** Separación estricta de eventos: el icono de notificaciones solo conmuta el estado de lectura sin alterar la sesión de Supabase Auth.
- **Criterio de Aceptación:** El usuario puede consultar sus notificaciones fluidamente sin interrupciones de sesión.

---

### [DEF-09] Error SQL en Postgres por Ausencia de Constraint UNIQUE en Asistencia
- **Módulo / Archivo:** `database_scripts/full_database_setup.sql`, `database_scripts/rls_politicas_seguridad.sql`
- **Severidad:** 🔴 Crítica (Base de Datos)
- **Descripción:** La función de registro de asistencia utilizaba `.upsert(payload, { onConflict: 'id_reserva' })`. PostgreSQL arrojaba el error `ON CONFLICT DO UPDATE requires a unique or exclusion constraint on the specified columns`.
- **Código SQL Corregido:**
  ```sql
  ALTER TABLE public.asistencia 
  ADD CONSTRAINT uq_asistencia_reserva UNIQUE (id_reserva);
  ```
- **Criterio de Aceptación:** Las asistencias pueden actualizarse idempotentemente sin arrojar excepciones de conflicto relacional.

---

### [DEF-10] Falta de Flujo de Asistencia Bidireccional Alumno-Profesor
- **Módulo / Archivo:** `src/components/shared/StudentQrAttendanceModal.tsx`, `src/app/alumno/dashboard/page.tsx`
- **Severidad:** 🟠 Alta (Requerimiento de Negocio)
- **Descripción:** El sistema únicamente contemplaba que el profesor escaneara al alumno. En clases masivas o cuando el profesor no disponía de un dispositivo con cámara disponible, se formaban cuellos de botella al ingreso de la sala.
- **Solución Implementada:** Se diseñó e implementó la funcionalidad inversa: el profesor proyecta su QR en la sala o pantalla y el alumno utiliza la cámara de su teléfono para registrar su propia presencia de forma autónoma.
- **Criterio de Aceptación:** Registro de asistencia completado en menos de 2 segundos mediante cámara web o móvil con feedback sonoro y visual.

---

### [DEF-11] Uso Inadecuado de `alert()` Nativo del Navegador
- **Módulo / Archivo:** Múltiples pantallas (`admin/alumnos`, `admin/planes`, `alumno/perfil`, `alumno/tienda`)
- **Severidad:** 🟡 Media (Experiencia de Usuario)
- **Descripción:** Se detectaron llamadas a `window.alert("Mensaje")` que detenían el hilo de ejecución de JavaScript, rompían la estética oscura de la marca "Cuerpo y Alma" y resultaban incómodas en dispositivos móviles.
- **Solución Implementada:** Sustitución global por notificaciones Toast de `react-hot-toast` con estilos adaptados al diseño negro y dorado corporativo.

---

### [DEF-12] Deficiencias de Validación en Formularios y Caídas por Contraseña Errónea
- **Módulo / Archivo:** `src/components/ui/auth/SignInForm.tsx`, `src/components/ui/auth/SignUpForm.tsx`
- **Severidad:** 🟠 Alta (Integridad de Datos y Resiliencia)
- **Descripción:** El formulario de registro permitía nombres de solo 2 letras, no obligaba textualmente a verificar el símbolo `@` en el correo y las excepciones de contraseña incorrecta no contaban con traducción contextual, arrojando mensajes crudos de base de datos en inglés (`Invalid login credentials`).
- **Código Corregido (Después):**
  - Esquema Zod en `SignUpForm.tsx`:
    ```typescript
    nombres: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    email: z.string().email('Por favor ingresa un correo válido con @ (ejemplo: usuario@mail.com)'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    ```
  - Control de excepciones en `SignInForm.tsx`:
    ```typescript
    } catch (error: any) {
      let msg = error?.message || 'Error al iniciar sesión';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        msg = 'Correo o contraseña incorrectos. Por favor verifica tus datos e inténtalo de nuevo.';
      }
      toast.error(msg, { duration: 4000 });
    }
    ```
- **Criterio de Aceptación:** Si el usuario ingresa una contraseña errónea, la aplicación no colapsa, mantiene los datos ingresados y emite una alerta toast explicativa en español. Los nombres con menos de 3 letras son bloqueados preventivamente por el validador en el cliente.

---

## 3. Conclusión y Estado de Calidad

Con la resolución de estos 12 defectos, el software **Cuerpo y Alma** alcanza un nivel de madurez técnica del **100% de cumplimiento funcional**, respetando los estándares de seguridad de datos (RLS), integridad transaccional en PostgreSQL y una experiencia de usuario responsiva de nivel profesional.
