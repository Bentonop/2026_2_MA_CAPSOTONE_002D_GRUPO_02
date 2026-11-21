# Informe Consolidado de Mejoras Técnicas, Arquitectura y Control de Calidad
**Proyecto:** Sistema Web Integral "Cuerpo y Alma"  
**Asignatura:** Capstone (PTY4614) - Escuela de Informática  
**Equipo de Desarrollo:** José Rivera, Benjamín García, Manuel Campos  
**Fecha:** Noviembre 2026  

---

## 1. Introducción y Alcance
El presente informe documenta cronológicamente todas las optimizaciones, correcciones de errores, rediseño de interfaz y mecanismos de verificación de calidad implementados en la plataforma web **"Cuerpo y Alma"** (desarrollada con Next.js 16, React 19, Tailwind CSS y Supabase PostgreSQL Cloud). 

El objetivo es proporcionar un respaldo técnico riguroso de cada funcionalidad construida, junto con las evidencias requeridas por la pauta disciplinar y el docente de la asignatura.

---

## 2. Cronología Detallada de Trabajos Realizados

### Fase 1: Corrección de Errores Técnicos y Arquitectura de Código
1. **Módulo Utilitario `cn()` y Limpieza de Dependencias:**
   - *Problema:* El proyecto tenía una dependencia rota en `package.json` (`"cn": "^0.4.0"`) y carecía del archivo `src/lib/utils.ts`, provocando `TypeError: cn is not a function` en componentes como Button, Input y Field.
   - *Solución:* Se eliminó la dependencia rota y se creó una implementación nativa de `cn()` con cero dependencias en `src/lib/utils.ts`.
2. **Montaje de Feedback Visual Global (`<Toaster />`):**
   - *Problema:* Las pantallas ejecutaban `toast.success()` y `toast.error()`, pero las alertas nunca aparecían en pantalla.
   - *Solución:* Se importó y montó `<Toaster position="top-right" />` de `react-hot-toast` en `src/app/layout.tsx`.
3. **Seguridad y Control de Acceso por Roles (RoleGuard):**
   - *Problema:* La URL `/profesor/clase/[id]` estaba desprotegida; cualquier alumno o visitante podía acceder a la lista de asistencia y al generador de QR.
   - *Solución:* Se blindó la pantalla envolviéndola con `<RoleGuard allowedRole="profesor">`, redirigiendo con HTTP 403 a usuarios no autorizados.
4. **Generación Dinámica de Código QR:**
   - *Problema:* La vista del docente contenía un `<svg>` estático con rectángulos falsos que ninguna cámara podía leer.
   - *Solución:* Se implementó `QRCodeSVG` de `qrcode.react`, codificando en tiempo real el identificador de clase, token de sesión y fecha.
5. **Regla de Negocio: Cancelación de Clases y Reembolso:**
   - *Problema:* Los alumnos podían cancelar clases sin límite de tiempo y perdían su cupo y crédito sin reintegro.
   - *Solución:* En `src/app/alumno/mis-clases/page.tsx`, se programó la validación estricta de al menos 2 horas de anticipación. Si se cumple, se libera el cupo físico de la clase (`+1`) y se reembolsa el crédito al plan del alumno.
6. **Aislamiento de Métricas del Docente (Data Isolation):**
   - *Problema:* El panel de métricas del profesor calculaba los alumnos e ingresos de todos los instructores del gimnasio.
   - *Solución:* Se aplicó el filtro relacional `.eq('id_profesor', user.id)` en `src/app/profesor/(main)/metricas/page.tsx`.
7. **Persistencia de Profesor Suplente:**
   - *Problema:* En el panel de administración, el cambio de profesor solo afectaba el estado local de React y se perdía al recargar.
   - *Solución:* Se agregó la llamada asíncrona a Supabase para actualizar `id_profesor` en la tabla `clase`.
8. **Estabilidad de Sesión en Cabecera (`Header.tsx`):**
   - *Problema:* El popover de notificaciones forzaba el cierre de sesión o redirigía indebidamente a login.
   - *Solución:* Se desacoplaron los controladores de eventos de lectura de notificaciones respecto a los de cierre de sesión.

---

### Fase 2: Rediseño Visual y Experiencia de Usuario (UI/UX)
1. **Componente de Marca e Isotipo Corporativo (`BrandLogo.tsx`):**
   - Se diseñó un logotipo vectorial en tonos dorados con gradientes, aura luminosa y tipografía sans-serif de alto contraste.
   - Se integró en las pantallas de Inicio de Sesión, Registro, Recuperación de Contraseña y Header.
2. **Iluminación Ambiental:**
   - Se agregaron orbes difuminados dorados en el fondo de la pantalla de bienvenida (`src/app/page.tsx`).
3. **Optimización de Barras de Navegación Móvil:**
   - Se centraron las barras inferiores (`BottomNavigation`, `ProfesorBottomNavigation`, `AdminBottomNavigation`) con `max-w-md mx-auto`, bordes redondeados y sombras `shadow-2xl`.
4. **Envoltura y Centrado de Contenedores:**
   - Se ajustó el contenido de los tres roles (`alumno`, `profesor`, `admin`) con `max-w-5xl mx-auto`.
5. **Erradicación de `window.alert()` Nativo:**
   - Se reemplazaron todas las alertas bloqueantes del navegador por notificaciones Toast fluidas y estilizadas.

---

### Fase 3: Asistencia QR Bidireccional
1. **Modal de Escaneo de Cámara para Alumnos:**
   - Se construyó `src/components/shared/StudentQrAttendanceModal.tsx`, permitiendo que el alumno active la cámara de su laptop o teléfono para escanear la pantalla del profesor.
2. **Restricción `UNIQUE` en Base de Datos PostgreSQL:**
   - Se añadió la restricción `UNIQUE (id_reserva)` en la tabla `asistencia` dentro de `full_database_setup.sql` y `rls_politicas_seguridad.sql`, garantizando la idempotencia del comando `.upsert()`.

---

### Fase 4: Laboratorio de Defectos y Verificación Interactiva (QA Lab)
1. **Pantalla Especial de Pruebas (`/qa-lab`):**
   - Ubicada en `http://localhost:3000/qa-lab`, accesible desde el login.
   - Permite a los evaluadores reproducir visualmente cada escenario de error (Antes) y contrastarlo con la solución corregida (Después) mediante botones en tiempo real.
2. **Script de Auditoría en Terminal (`test_simulacion_errores_qa.mjs`):**
   - Ejecuta de forma automatizada las 7 suites de prueba, generando un reporte en `docs_universidad/Evidencia_Log_Errores_Consola.txt` con un resultado de **7/7 Pruebas Aprobadas (100% PASS)**.

---

### Fase 5: Validaciones de Registro y Resiliencia en Inicio de Sesión
1. **Validación de Nombre (&ge; 3 letras):**
   - En `SignUpForm.tsx`, el campo `nombres` exige un mínimo de 3 caracteres con el esquema Zod:  
     `z.string().min(3, 'El nombre debe tener al menos 3 caracteres')`.
2. **Validación de Correo Electrónico (Debe incluir '@' y dominio):**
   - En `SignInForm.tsx` y `SignUpForm.tsx`, se valida la estructura de correo electrónico con retroalimentación explícita:  
     `z.string().email("Por favor ingresa un correo válido con @ (ejemplo: usuario@mail.com)")`.
3. **Validación de Contraseña (&ge; 6 caracteres):**
   - Se exige una longitud mínima de 6 caracteres para mitigar vulnerabilidades por contraseñas triviales:  
     `z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')`.
4. **Resiliencia ante Inicio de Sesión Fallido o Contraseña Incorrecta:**
   - En `SignInForm.tsx`, el bloque `try/catch` previene cualquier caída de la aplicación. Al recibir un error de autenticación de Supabase (`Invalid login credentials`), el sistema captura la excepción, resetea el indicador de carga y notifica al usuario en español:  
     *"Correo o contraseña incorrectos. Por favor verifica tus datos e inténtalo de nuevo."*  
     El DOM permanece intacto y la experiencia no se interrumpe.
5. **Módulo de Prueba en Vivo en `/qa-lab`:**
   - Se incorporó la pestaña **`DEF-12: Auth & Inputs`** en el Laboratorio de QA para testear interactivamente los nombres cortos, correos sin arroba, claves de menos de 6 caracteres y el login fallido controlado.

---

## 3. Matriz de Estado de Entregables para el Profesor

| Entregable | Archivo de Respaldo | Estado |
| :--- | :--- | :--- |
| **Bitácora Formal de Errores** | `docs_universidad/BITACORA_DE_ERRORES_QA.md` | ✅ Completada (12 defectos) |
| **Informe Consolidado** | `docs_universidad/INFORME_COMPLETO_DE_MEJORAS_Y_EVIDENCIAS.md` | ✅ Completado |
| **Log de Ejecución en Consola** | `docs_universidad/Evidencia_Log_Errores_Consola.txt` | ✅ 7/7 Aprobadas |
| **Laboratorio Visual en Localhost** | `http://localhost:3000/qa-lab` | ✅ Operativo |
| **Formularios de Autenticación** | `src/components/ui/auth/SignInForm.tsx` y `SignUpForm.tsx` | ✅ Validaciones activas |
| **Esquema de Base de Datos SQL** | `database_scripts/full_database_setup.sql` | ✅ Sincronizado |
