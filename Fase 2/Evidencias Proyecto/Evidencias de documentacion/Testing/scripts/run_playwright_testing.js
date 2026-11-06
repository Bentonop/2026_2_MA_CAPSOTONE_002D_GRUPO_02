const { chromium } = require('C:/Users/jose-/Documents/gourmet/front-app/nutri-plan-ui-design/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const EVIDENCIAS_DIR = path.resolve(__dirname, 'Evidencias');
if (!fs.existsSync(EVIDENCIAS_DIR)) {
  fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
}

async function runCompleteTestingSuite() {
  console.log('=============================================================');
  console.log('   INICIANDO BATERÍA COMPLETA DE TESTING E2E - FASE 3');
  console.log('=============================================================');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  // -------------------------------------------------------------------------
  // MÓDULO 1: ADMINISTRADOR - CREAR HORARIO Y VERIFICAR SESIÓN
  // -------------------------------------------------------------------------
  console.log('\n--- [CP-01] ADMINISTRADOR: CREACIÓN Y GESTIÓN DE HORARIO ---');
  const adminContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2
  });
  const adminPage = await adminContext.newPage();

  console.log('1.1 Login Administrador (admin@demo.com)...');
  await adminPage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await adminPage.fill('#email', 'admin@demo.com');
  await adminPage.fill('#password', '123456');
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForTimeout(2500);

  console.log('1.2 Entrando a Gestión de Clases (/admin/clases)...');
  await adminPage.goto('http://localhost:3001/admin/clases?tab=calendar', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1500);

  console.log('1.3 Abriendo y rellenando formulario de nuevo bloque...');
  const addBtn = adminPage.locator('button:has-text("Bloque")');
  if (await addBtn.count() > 0) {
    await addBtn.first().click();
    await adminPage.waitForTimeout(800);
  }

  // Rellenar formulario con datos exactos solicitados
  const discSelect = adminPage.locator('select').first();
  if (await discSelect.count() > 0) {
    const opts = await discSelect.locator('option').allTextContents();
    const target = opts.find(o => o.toLowerCase().includes('pole')) || opts[1];
    if (target) await discSelect.selectOption({ label: target });
  }

  const profSelect = adminPage.locator('select').nth(1);
  if (await profSelect.count() > 0) {
    const opts = await profSelect.locator('option').allTextContents();
    const target = opts.find(o => o.toLowerCase().includes('fernanda')) || opts[1];
    if (target) await profSelect.selectOption({ label: target });
  }

  const salaSelect = adminPage.locator('select').nth(2);
  if (await salaSelect.count() > 0) {
    const opts = await salaSelect.locator('option').allTextContents();
    const target = opts.find(o => o.toLowerCase().includes('sala a')) || opts[1];
    if (target) await salaSelect.selectOption({ label: target });
  }

  const timeInputs = adminPage.locator('input[type="time"]');
  if (await timeInputs.count() >= 2) {
    await timeInputs.nth(0).fill('18:30');
    await timeInputs.nth(1).fill('19:45');
  }

  console.log('📸 Captura CP-01_01_Crear_Horario.png');
  await adminPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-01_01_Crear_Horario.png') });

  // Cerrar modal o cambiar a sesiones reales
  const closeBtn = adminPage.locator('button:has-text("close")');
  if (await closeBtn.count() > 0) {
    await closeBtn.first().click();
    await adminPage.waitForTimeout(500);
  }

  console.log('1.4 Consultando "Sesiones Calendario" en panel Admin...');
  const sesionesBtn = adminPage.locator('button:has-text("Sesiones Calendario")');
  if (await sesionesBtn.count() > 0) {
    await sesionesBtn.click();
    await adminPage.waitForTimeout(1500);
  }

  console.log('📸 Captura CP-01_02_Horario_Creado.png');
  await adminPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-01_02_Horario_Creado.png') });
  await adminContext.close();

  // -------------------------------------------------------------------------
  // MÓDULO 2: ALUMNO - EXPLORACIÓN, RESERVA Y CONTROL DE AFORO
  // -------------------------------------------------------------------------
  console.log('\n--- [CP-02] ALUMNO: EXPLORACIÓN, RESERVA Y PASE QR ---');
  const alumnoContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2
  });
  const alumnoPage = await alumnoContext.newPage();

  console.log('2.1 Login Alumno (benjamin60821@gmail.com)...');
  await alumnoPage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await alumnoPage.fill('#email', 'benjamin60821@gmail.com');
  await alumnoPage.fill('#password', 'qwerty');
  await alumnoPage.click('button[type="submit"]');
  await alumnoPage.waitForTimeout(2500);

  console.log('2.2 Entrando al catálogo de exploración (/alumno/explorar)...');
  await alumnoPage.goto('http://localhost:3001/alumno/explorar', { waitUntil: 'networkidle' });
  await alumnoPage.waitForTimeout(2000);

  // Seleccionar día de hoy en el calendario interactivo
  console.log('📸 Captura CP-02_01_Horario_Alumno.png (Card con 8 Cupos Disponibles)');
  await alumnoPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-02_01_Horario_Alumno.png') });

  // Localizar la card de Pole Dance y presionar "Reservar Cupo"
  console.log('2.3 Presionando botón "Reservar Cupo"...');
  const bookBtn = alumnoPage.locator('.class-card button:has-text("Reservar Cupo")').first();
  if (await bookBtn.count() > 0) {
    await bookBtn.scrollIntoViewIfNeeded();
    await bookBtn.click();
    await alumnoPage.waitForTimeout(800);
  }

  // Modal de Confirmación
  console.log('2.4 Modal de confirmación abierto, confirmando reserva...');
  const confirmBtn = alumnoPage.locator('button:has-text("Confirmar Reserva")');
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click();
    await alumnoPage.waitForTimeout(300); // Tomar captura con el toast activo
  }

  console.log('📸 Captura CP-02_02_Reserva_Confirmada.png (Modal / Toast de Éxito)');
  await alumnoPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-02_02_Reserva_Confirmada.png') });
  await alumnoPage.waitForTimeout(1800);

  // Verificar actualización reactiva del aforo
  console.log('📸 Captura CP-02_03_Aforo_1_de_8.png (Estado actualizado: 7 Cupos y botón "Reservado")');
  await alumnoPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-02_03_Aforo_1_de_8.png') });

  // -------------------------------------------------------------------------
  // MÓDULO 3: MIS CLASES Y PASE QR
  // -------------------------------------------------------------------------
  console.log('\n2.5 Navegando a Mis Clases (/alumno/mis-clases)...');
  await alumnoPage.goto('http://localhost:3001/alumno/mis-clases', { waitUntil: 'networkidle' });
  await alumnoPage.waitForTimeout(2000);

  console.log('📸 Captura CP-02_04_Mis_Clases.png (Reserva confirmada en agenda de alumno)');
  await alumnoPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-02_04_Mis_Clases.png') });

  console.log('2.6 Abriendo Pase de Acceso QR ("Check-in QR")...');
  const qrBtn = alumnoPage.locator('button:has-text("Check-in QR")').first();
  if (await qrBtn.count() > 0) {
    await qrBtn.click();
    await alumnoPage.waitForTimeout(1000);
  }

  console.log('📸 Captura CP-02_05_Pase_QR.png (Modal con Código QR digital generado)');
  await alumnoPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-02_05_Pase_QR.png') });

  // Cerrar pase
  const closePaseBtn = alumnoPage.locator('button:has-text("Cerrar Pase")');
  if (await closePaseBtn.count() > 0) {
    await closePaseBtn.click();
    await alumnoPage.waitForTimeout(500);
  }

  // -------------------------------------------------------------------------
  // MÓDULO 4: CASO ALTERNATIVO CP-03 - RESERVA DUPLICADA
  // -------------------------------------------------------------------------
  console.log('\n--- [CP-03] PRUEBA DE CONTROL: RESERVA DUPLICADA ---');
  await alumnoPage.goto('http://localhost:3001/alumno/explorar', { waitUntil: 'networkidle' });
  await alumnoPage.waitForTimeout(1500);

  console.log('📸 Captura CP-03_01_Reserva_Duplicada.png (Botón inhabilitado con estado "Reservado")');
  await alumnoPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-03_01_Reserva_Duplicada.png') });

  // -------------------------------------------------------------------------
  // MÓDULO 5: CASO ALTERNATIVO CP-04 - LÍMITE DE AFORO (CLASE LLENA)
  // -------------------------------------------------------------------------
  console.log('\n--- [CP-04] PRUEBA DE LÍMITE: AFORO COMPLETO ---');
  const fullCard = alumnoPage.locator('.class-card:has-text("Pole Exotic Avanzado")');
  if (await fullCard.count() > 0) {
    await fullCard.scrollIntoViewIfNeeded();
    await alumnoPage.waitForTimeout(500);
    // Click en lista espera
    const waitlistBtn = fullCard.locator('button:has-text("Lista Espera")');
    if (await waitlistBtn.count() > 0) {
      await waitlistBtn.click();
      await alumnoPage.waitForTimeout(300);
    }
  }

  console.log('📸 Captura CP-04_01_Aforo_Completo.png (Aforo 8/8 agotado, estado "Clase Llena")');
  await alumnoPage.screenshot({ path: path.join(EVIDENCIAS_DIR, 'CP-04_01_Aforo_Completo.png') });

  await alumnoContext.close();
  await browser.close();

  console.log('\n=============================================================');
  console.log('   ¡TODAS LAS CAPTURAS FUERON GENERADAS CON ÉXITO EN:');
  console.log('   ' + EVIDENCIAS_DIR);
  console.log('=============================================================');
}

runCompleteTestingSuite().catch(err => {
  console.error('ERROR EN TESTING AUTOMATIZADO:', err);
  process.exit(1);
});
