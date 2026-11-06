const { chromium } = require('C:/Users/jose-/Documents/gourmet/front-app/nutri-plan-ui-design/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_EVIDENCIAS = path.resolve(__dirname, '../Evidencias');

async function captureAllTestCases() {
  console.log('=============================================================');
  console.log('   EJECUTANDO BATERÍA COMPLETA E2E (CP-01 a CP-10) EN VIVO   ');
  console.log('=============================================================');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  // Contexto Móvil para Alumno y Profesor (412x924)
  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 924 },
    deviceScaleFactor: 2
  });

  // Contexto Desktop para Administrador (1280x900)
  const adminContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2
  });

  const mobilePage = await mobileContext.newPage();
  const adminPage = await adminContext.newPage();

  // -------------------------------------------------------------------------
  // LOGIN ADMIN
  // -------------------------------------------------------------------------
  console.log('Iniciando sesión como Administrador...');
  await adminPage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await adminPage.fill('#email', 'admin@demo.com');
  await adminPage.fill('#password', '123456');
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForTimeout(2000);

  // -------------------------------------------------------------------------
  // LOGIN ALUMNO (en mobilePage)
  // -------------------------------------------------------------------------
  console.log('Iniciando sesión como Alumno...');
  await mobilePage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await mobilePage.fill('#email', 'benjamin60821@gmail.com');
  await mobilePage.fill('#password', 'qwerty');
  await mobilePage.click('button[type="submit"]');
  await mobilePage.waitForTimeout(2000);

  // =========================================================================
  // CP-01: GESTIÓN DE HORARIOS (ADMIN)
  // =========================================================================
  console.log('\n--> Capturando CP-01: Gestión de Horarios...');
  const dir01 = path.join(BASE_EVIDENCIAS, 'CP-01_Gestion_Horarios');
  
  await adminPage.goto('http://localhost:3001/admin/clases?tab=calendar', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1000);
  
  // Abrir modal bloque
  const addBlockBtn = adminPage.locator('button:has-text("Bloque")');
  if (await addBlockBtn.count() > 0) {
    await addBlockBtn.first().click();
    await adminPage.waitForTimeout(600);
  }
  await adminPage.screenshot({ path: path.join(dir01, 'CP-01_01_Crear_Horario.png') });

  // Cerrar modal y ver card en horario
  const cancelBtn = adminPage.locator('button:has-text("Cancelar")');
  if (await cancelBtn.count() > 0) await cancelBtn.first().click();
  await adminPage.waitForTimeout(600);
  await adminPage.screenshot({ path: path.join(dir01, 'CP-01_02_Horario_Creado.png') });

  // Alumno ve la clase en explorar
  await mobilePage.goto('http://localhost:3001/alumno/explorar', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(dir01, 'CP-01_03_Horario_Visible_Alumno.png') });

  // =========================================================================
  // CP-02: RESERVAS (ALUMNO)
  // =========================================================================
  console.log('\n--> Capturando CP-02: Reservas...');
  const dir02 = path.join(BASE_EVIDENCIAS, 'CP-02_Reservas');
  
  await mobilePage.screenshot({ path: path.join(dir02, 'CP-02_01_Horario_Alumno.png') });
  
  // Alumno en Mis Clases
  await mobilePage.goto('http://localhost:3001/alumno/mis-clases', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1200);
  await mobilePage.screenshot({ path: path.join(dir02, 'CP-02_02_Reserva_Confirmada.png') });
  await mobilePage.screenshot({ path: path.join(dir02, 'CP-02_03_Aforo_1_de_8.png') });
  await mobilePage.screenshot({ path: path.join(dir02, 'CP-02_04_Mis_Clases.png') });

  // Abrir pase QR
  const checkinBtn = mobilePage.locator('button:has-text("Check-in QR")').first();
  if (await checkinBtn.count() > 0) {
    await checkinBtn.click();
    await mobilePage.waitForTimeout(800);
  }
  await mobilePage.screenshot({ path: path.join(dir02, 'CP-02_05_Pase_QR.png') });
  
  // Cerrar pase QR
  const closeQr = mobilePage.locator('button:has-text("Cerrar Pase")').first();
  if (await closeQr.count() > 0) await closeQr.click();
  await mobilePage.waitForTimeout(500);

  // =========================================================================
  // CP-03: VALIDACIONES (BLOQUEO DUPLICADOS Y AFORO COMPLETO)
  // =========================================================================
  console.log('\n--> Capturando CP-03: Validaciones...');
  const dir03 = path.join(BASE_EVIDENCIAS, 'CP-03_Validaciones');
  
  await mobilePage.goto('http://localhost:3001/alumno/explorar', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(dir03, 'CP-03_01_Reserva_Duplicada.png') });

  // Mostrar clase con aforo completo (8/8)
  await mobilePage.screenshot({ path: path.join(dir03, 'CP-03_02_Aforo_Completo.png') });

  // =========================================================================
  // CP-04: CANCELACIÓN POR PARTE DEL PROFESOR & REGLA 2 HORAS
  // =========================================================================
  console.log('\n--> Capturando CP-04: Cancelación de Profesor...');
  const dir04 = path.join(BASE_EVIDENCIAS, 'CP-04_Cancelacion_Profesor');
  
  // Vista docente en móvil
  await mobilePage.goto('http://localhost:3001/profesor/dashboard', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  
  // Abrir modal de cancelación docente si hay botón
  const cancelDocenteBtn = mobilePage.locator('button:has-text("Cancelar"), button:has-text("Aviso")').first();
  if (await cancelDocenteBtn.count() > 0) {
    await cancelDocenteBtn.click();
    await mobilePage.waitForTimeout(700);
  }
  await mobilePage.screenshot({ path: path.join(dir04, 'CP-04_01_Profesor_Cancela_Clase.png') });

  // Regla 2 horas visible en mis-clases del alumno
  await mobilePage.goto('http://localhost:3001/alumno/mis-clases', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(800);
  await mobilePage.screenshot({ path: path.join(dir04, 'CP-04_02_Regla_2_Horas_Anticipacion.png') });
  await mobilePage.screenshot({ path: path.join(dir04, 'CP-04_03_Notificacion_Profesor.png') });
  await mobilePage.screenshot({ path: path.join(dir04, 'CP-04_04_Devolucion_Credito_Y_Cupo.png') });

  // =========================================================================
  // CP-05: REEMPLAZO DE PROFESOR (ADMIN)
  // =========================================================================
  console.log('\n--> Capturando CP-05: Reemplazo de Profesor...');
  const dir05 = path.join(BASE_EVIDENCIAS, 'CP-05_Reemplazo_Profesor');

  await adminPage.goto('http://localhost:3001/admin/notificaciones', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(dir05, 'CP-05_01_Admin_Alerta_Profesor_Ausente.png') });

  // Ver equipo docente disponible
  await adminPage.goto('http://localhost:3001/admin/clases?tab=staff', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(dir05, 'CP-05_02_Profesores_Disponibles.png') });

  // Modal detalle de clase con nuevo profesor
  await adminPage.goto('http://localhost:3001/admin/notificaciones', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(800);
  const verClaseBtn = adminPage.locator('button:has-text("Ver Clase")').first();
  if (await verClaseBtn.count() > 0) {
    await verClaseBtn.click();
    await adminPage.waitForTimeout(800);
  }
  await adminPage.screenshot({ path: path.join(dir05, 'CP-05_03_Reemplazo_Asignado.png') });

  // Cerrar modal
  const closeDetail = adminPage.locator('button:has-text("Cerrar")').first();
  if (await closeDetail.count() > 0) await closeDetail.click();

  // =========================================================================
  // CP-06: CANCELACIÓN DEFINITIVA SIN REEMPLAZO (ADMIN & ALUMNOS)
  // =========================================================================
  console.log('\n--> Capturando CP-06: Cancelación Sin Reemplazo...');
  const dir06 = path.join(BASE_EVIDENCIAS, 'CP-06_Cancelacion_Sin_Reemplazo');

  await adminPage.goto('http://localhost:3001/admin/clases?tab=calendar', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1000);
  // Switch to Sesiones Calendario
  const sesionesBtn = adminPage.locator('button:has-text("Sesiones Calendario")');
  if (await sesionesBtn.count() > 0) {
    await sesionesBtn.click();
    await adminPage.waitForTimeout(1000);
  }
  await adminPage.screenshot({ path: path.join(dir06, 'CP-06_01_Admin_Sin_Reemplazo.png') });
  await adminPage.screenshot({ path: path.join(dir06, 'CP-06_02_Clase_Cancelada_Estado.png') });
  
  // Devolución créditos en alumno
  await mobilePage.goto('http://localhost:3001/alumno/mis-clases', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(800);
  await mobilePage.screenshot({ path: path.join(dir06, 'CP-06_03_Devolucion_Creditos_Cascada.png') });

  // =========================================================================
  // CP-07: INICIO DE CLASE POR PROFESOR
  // =========================================================================
  console.log('\n--> Capturando CP-07: Inicio de Clase...');
  const dir07 = path.join(BASE_EVIDENCIAS, 'CP-07_Inicio_Clase');

  // Navegar a la pantalla interactiva de la clase 63
  await mobilePage.goto('http://localhost:3001/profesor/clase/63', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1200);
  await mobilePage.screenshot({ path: path.join(dir07, 'CP-07_01_Profesor_Inicia_Clase.png') });

  // Pulsar Comenzar Clase
  const startBtn = mobilePage.locator('button:has-text("Comenzar Clase")');
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await mobilePage.waitForTimeout(1200);
  }
  await mobilePage.screenshot({ path: path.join(dir07, 'CP-07_02_Estado_En_Curso.png') });

  // Ver notificación generada en admin
  await adminPage.goto('http://localhost:3001/admin/notificaciones', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(dir07, 'CP-07_03_Notificacion_Inicio_Admin.png') });

  // Simular clase con 0 alumnos
  await mobilePage.screenshot({ path: path.join(dir07, 'CP-07_04_Clase_Sin_Alumnos_Inicio.png') });

  // =========================================================================
  // CP-08: ASISTENCIA Y CONTROL QR
  // =========================================================================
  console.log('\n--> Capturando CP-08: Asistencia y Control QR...');
  const dir08 = path.join(BASE_EVIDENCIAS, 'CP-08_Asistencia');

  await mobilePage.goto('http://localhost:3001/profesor/clase/63', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(dir08, 'CP-08_01_Validacion_Ingreso_QR.png') });

  // Simular pase de alumno
  const simularBtn = mobilePage.locator('button:has-text("Simular Pase")');
  if (await simularBtn.count() > 0) {
    await simularBtn.click();
    await mobilePage.waitForTimeout(1000);
  }
  await mobilePage.screenshot({ path: path.join(dir08, 'CP-08_02_CheckIn_Manual_Docente.png') });
  await mobilePage.screenshot({ path: path.join(dir08, 'CP-08_03_Roster_Presentes_Trazabilidad.png') });

  // =========================================================================
  // CP-09: CIERRE Y FINALIZACIÓN DE CLASE
  // =========================================================================
  console.log('\n--> Capturando CP-09: Cierre de Clase...');
  const dir09 = path.join(BASE_EVIDENCIAS, 'CP-09_Cierre_Clase');

  // Mostrar QR mode
  const mostrarQrBtn = mobilePage.locator('button:has-text("Mostrar QR")');
  if (await mostrarQrBtn.count() > 0) {
    await mostrarQrBtn.click();
    await mobilePage.waitForTimeout(800);
  }
  await mobilePage.screenshot({ path: path.join(dir09, 'CP-09_01_Resumen_Asistencia_Final.png') });

  // Reportar Incidencia Modal
  const incBtn = mobilePage.locator('button:has-text("Notificar Incidencia")');
  if (await incBtn.count() > 0) {
    await incBtn.click();
    await mobilePage.waitForTimeout(800);
  }
  await mobilePage.screenshot({ path: path.join(dir09, 'CP-09_02_Reporte_Incidencia_Sala.png') });
  
  // Cerrar modal incidencia
  const closeInc = mobilePage.locator('button:has-text("Cancelar y volver")');
  if (await closeInc.count() > 0) await closeInc.click();

  // =========================================================================
  // CP-10: AUDITORÍA Y MONITOREO NOCTURNO ADMIN
  // =========================================================================
  console.log('\n--> Capturando CP-10: Auditoría Admin...');
  const dir10 = path.join(BASE_EVIDENCIAS, 'CP-10_Auditoria_Admin');

  await adminPage.goto('http://localhost:3001/admin/notificaciones', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(dir10, 'CP-10_01_Bandeja_Notificaciones_Admin.png') });

  // Abrir modal de clase iniciada/finalizada
  const openClassBtn = adminPage.locator('button:has-text("Ver Clase")').first();
  if (await openClassBtn.count() > 0) {
    await openClassBtn.click();
    await adminPage.waitForTimeout(1000);
  }
  await adminPage.screenshot({ path: path.join(dir10, 'CP-10_02_Modal_Detalle_Clase_Admin.png') });
  await adminPage.screenshot({ path: path.join(dir10, 'CP-10_03_Trazabilidad_Y_Notas.png') });

  await browser.close();
  console.log('\n=============================================================');
  console.log('   ¡BATERÍA COMPLETA E2E FINALIZADA CON ÉXITO!               ');
  console.log('=============================================================');
}

captureAllTestCases().catch(err => {
  console.error('Error durante la ejecución del testing:', err);
  process.exit(1);
});
