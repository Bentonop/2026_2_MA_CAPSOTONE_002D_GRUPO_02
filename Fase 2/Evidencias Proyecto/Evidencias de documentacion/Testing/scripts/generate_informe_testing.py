# -*- coding: utf-8 -*-
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import os

def set_cell_font(cell, text, bold=False, italic=False, color_rgb=(27, 38, 59), size_pt=9.0, align=WD_ALIGN_PARAGRAPH.LEFT):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor(*color_rgb)

def set_cell_bg(cell, fill_hex):
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))

def set_cell_margins(cell, top=100, bottom=100, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_heading_styled(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.bold = True
    if level == 1:
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        run.font.size = Pt(15)
        run.font.color.rgb = RGBColor(31, 56, 100) # Duoc Navy
    elif level == 2:
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        run.font.size = Pt(12)
        run.font.color.rgb = RGBColor(0, 102, 153) # Teal/Blue
    elif level == 3:
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(2)
        run.font.size = Pt(10.5)
        run.font.color.rgb = RGBColor(60, 60, 60)
    return p

def create_full_informe_testing():
    doc = docx.Document()
    
    # Configuración de márgenes estándar Duoc UC (2 cm)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    base_dir = r'C:\Users\jose-\Downloads\stitch_cuerpo_y_alma\stitch_cuerpo_y_alma\app-cuerpo-y-alma\Fase 3\Testing'
    evidencias_dir = os.path.join(base_dir, 'Evidencias')

    # -------------------------------------------------------------
    # ENCABEZADO INSTITUCIONAL
    # -------------------------------------------------------------
    header_p = doc.add_paragraph()
    header_p.paragraph_format.space_after = Pt(2)
    run_inst = header_p.add_run("DUOC UC · ESCUELA DE INFORMÁTICA Y TELECOMUNICACIONES\n")
    run_inst.font.name = "Calibri"
    run_inst.font.size = Pt(9.0)
    run_inst.bold = True
    run_inst.font.color.rgb = RGBColor(120, 120, 120)

    run_sub = header_p.add_run("PROYECTO CAPSTONE (PTY4614) · FASE 3: VERIFICACIÓN, TESTING Y CONTROL DE CALIDAD")
    run_sub.font.name = "Calibri"
    run_sub.font.size = Pt(9.5)
    run_sub.font.color.rgb = RGBColor(0, 150, 214)

    # TÍTULO PRINCIPAL
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(8)
    title_p.paragraph_format.space_after = Pt(6)
    run_t = title_p.add_run("Informe Integral de Pruebas Funcionales E2E\nGestión de Clases, Aforo, Cancelaciones y Asistencia QR")
    run_t.font.name = "Calibri"
    run_t.font.size = Pt(18)
    run_t.bold = True
    run_t.font.color.rgb = RGBColor(31, 56, 100)

    # METADATOS TÉCNICOS
    meta_table = doc.add_table(rows=5, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ["Proyecto:", "Sistema Web Integral para la Gestión de Academia de Pole Dance «Cuerpo y Alma»"],
        ["Área Evaluada:", "Módulos de Horarios, Reservas, Aforo, Cancelaciones, Relevos, Asistencia y Auditoría"],
        ["Equipo de Trabajo:", "José Rivera, Benjamín García, Manuel Campos"],
        ["Docente Guía:", "Reginaldo Salinas"],
        ["Estándar Aplicado:", "IEEE 829 / ISTQB / Criterios de Evaluación Capstone Duoc UC (Fase 3)"]
    ]
    for row_idx, (k, v) in enumerate(meta_data):
        row = meta_table.rows[row_idx]
        set_cell_font(row.cells[0], k, bold=True, color_rgb=(31, 56, 100), size_pt=9.0)
        set_cell_bg(row.cells[0], "F2F4F8")
        set_cell_margins(row.cells[0], 60, 60, 100, 100)
        
        set_cell_font(row.cells[1], v, bold=False, color_rgb=(40, 40, 40), size_pt=9.0)
        set_cell_bg(row.cells[1], "FFFFFF" if row_idx % 2 == 0 else "F9FAFC")
        set_cell_margins(row.cells[1], 60, 60, 100, 100)

    # SEPARADOR
    p_sep = doc.add_paragraph()
    p_sep.paragraph_format.space_before = Pt(8)
    p_sep.paragraph_format.space_after = Pt(8)

    # -------------------------------------------------------------
    # 1. RESUMEN EJECUTIVO Y OBJETIVOS DE TESTING
    # -------------------------------------------------------------
    add_heading_styled(doc, "1. Resumen Ejecutivo y Alcance del Testing", level=1)
    
    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.line_spacing = 1.15
    p_intro.paragraph_format.space_after = Pt(6)
    p_intro.add_run(
        "El presente informe documenta la ejecución exhaustiva de las pruebas funcionales End-to-End (E2E) correspondientes "
        "a la Fase 3 del Proyecto Capstone para el sistema web «Cuerpo y Alma». La batería de pruebas no se limita a un flujo "
        "básico de reserva, sino que abarca de extremo a extremo las 4 dimensiones críticas del negocio académico: "
        "(1) Creación y replicación semanal de horarios con aforo parametrizado; (2) Experiencia del alumno en reserva y emisión de pases QR; "
        "(3) Protocolo integral de contingencias (cancelación docente, validación de la regla de 2 horas de anticipación, búsqueda y asignación "
        "de profesores de relevo, o cancelación definitiva con restitución en cascada de créditos); y (4) Operación en aula mediante inicio de sesión, "
        "registro de asistencia por QR o manual, reporte de incidentes y auditoría nocturna centralizada para la administración."
    )

    # -------------------------------------------------------------
    # 2. MATRIZ MAESTRA DE CASOS DE PRUEBA (CP-01 a CP-10)
    # -------------------------------------------------------------
    add_heading_styled(doc, "2. Matriz Maestra de Casos de Prueba (CP-01 a CP-10)", level=1)
    
    matrix_table = doc.add_table(rows=11, cols=5)
    matrix_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    headers = ["ID", "Módulo", "Caso de Prueba", "Resultado Esperado", "Estado"]
    col_widths = [Inches(0.7), Inches(1.2), Inches(1.8), Inches(2.3), Inches(0.9)]
    
    for c_idx, h_text in enumerate(headers):
        cell = matrix_table.rows[0].cells[c_idx]
        set_cell_font(cell, h_text, bold=True, color_rgb=(255, 255, 255), size_pt=9.0, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_bg(cell, "1F3864")
        set_cell_margins(cell, 80, 80, 80, 80)

    test_matrix_data = [
        ("CP-01", "Horarios", "Creación de bloque semanal por Administrador", "Clase creada con 0/8 cupos y visible para alumnos", "✅ Aprobado"),
        ("CP-02", "Reservas", "Reserva de cupo y generación de Pase QR", "Reserva registrada, aforo a 1/8 y QR emitido", "✅ Aprobado"),
        ("CP-03", "Validaciones", "Bloqueo de duplicados y aforo máximo (8/8)", "Sistema impide reservas repetidas o sobrecupo", "✅ Aprobado"),
        ("CP-04", "Cancelación", "Profesor suspende sesión y regla 2 horas", "Validación temporal, crédito devuelto y cupo liberado", "✅ Aprobado"),
        ("CP-05", "Reemplazo", "Admin busca y asigna profesor suplente", "Docente disponible asignado; clase sigue confirmada", "✅ Aprobado"),
        ("CP-06", "Sin Reemplazo", "Cancelación definitiva por falta de suplente", "Clase dada de baja y reembolso en cascada de créditos", "✅ Aprobado"),
        ("CP-07", "Inicio Clase", "Profesor inicia sesión y alerta a admin", "Estado 'EN CURSO', timestamp y notificación operativa", "✅ Aprobado"),
        ("CP-08", "Asistencia", "Control de acceso vía QR y check-in manual", "Marcación de 'Presente' y hora exacta en base de datos", "✅ Aprobado"),
        ("CP-09", "Cierre Clase", "Finalización de sesión y reporte de sala", "Balance final de asistencia y modal de incidentes", "✅ Aprobado"),
        ("CP-10", "Auditoría", "Admin consulta métricas e historial nocturno", "Trazabilidad completa: inscritos, presentes y notas", "✅ Aprobado")
    ]

    for r_idx, row_vals in enumerate(test_matrix_data, start=1):
        row = matrix_table.rows[r_idx]
        bg_color = "F9FAFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row_vals):
            cell = row.cells[c_idx]
            is_status = (c_idx == 4)
            is_id = (c_idx == 0)
            align = WD_ALIGN_PARAGRAPH.CENTER if (is_id or is_status) else WD_ALIGN_PARAGRAPH.LEFT
            text_color = (0, 128, 0) if is_status else (31, 56, 100) if is_id else (40, 40, 40)
            set_cell_font(cell, val, bold=(is_id or is_status), color_rgb=text_color, size_pt=8.5, align=align)
            set_cell_bg(cell, bg_color)
            set_cell_margins(cell, 60, 60, 80, 80)

    # -------------------------------------------------------------
    # 3. FICHAS TÉCNICAS DETALLADAS CASO POR CASO
    # -------------------------------------------------------------
    add_heading_styled(doc, "3. Fichas Técnicas Detalladas de Casos de Prueba y Evidencias", level=1)

    casos_detalle = [
        {
            "id": "CP-01",
            "titulo": "Gestión y Creación de Horarios por el Administrador",
            "folder": "CP-01_Gestion_Horarios",
            "modulo": "Gestión de Horarios y Replicación Semanal",
            "objetivo": "Validar que el Administrador puede dar de alta un bloque horario semanal (Disciplina: Pole Dance, Docente: Fernanda Pánico, Sala: Sala A, 18:30 hrs, cupo: 8) y que queda inmediatamente registrado en la agenda del sistema para la semana entrante.",
            "precondiciones": "Usuario con rol Administrador (admin@demo.com) autenticado con sesión activa.",
            "pasos": [
                "1. Iniciar sesión como Administrador y navegar a /admin/clases?tab=calendar.",
                "2. Hacer clic en '+ Bloque' para desplegar el modal de nuevo horario.",
                "3. Seleccionar la disciplina 'Pole Dance', docente 'Fernanda Pánico', sala 'Sala A', día y hora (18:30 hrs).",
                "4. Guardar el bloque y confirmar que el aforo inicial muestra 0/8 inscritos.",
                "5. Ingresar a la vista Alumno (/alumno/explorar) y verificar que la clase aparece disponible con 8 cupos libres."
            ],
            "resultado_esperado": "El bloque queda persistido en BD, muestra 0/8 inscritos y se sincroniza en la agenda de los estudiantes.",
            "resultado_obtenido": "Bloque creado correctamente en panel administrativo con aforo 0/8 y reflejado de inmediato en el catálogo de alumnos.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-01_01_Crear_Horario.png", "Evidencia CP-01.1: Formulario modal de configuración de nuevo bloque horario por Administrador."),
                ("CP-01_02_Horario_Creado.png", "Evidencia CP-01.2: Panel administrativo mostrando la card del bloque creado con aforo 0/8."),
                ("CP-01_03_Horario_Visible_Alumno.png", "Evidencia CP-01.3: Agenda del Alumno reflejando la disponibilidad inmediata de la sesión.")
            ]
        },
        {
            "id": "CP-02",
            "titulo": "Flujo de Reserva y Emisión de Pase QR por el Alumno",
            "folder": "CP-02_Reservas",
            "modulo": "Reservas de Alumnos y Pase Digital",
            "objetivo": "Comprobar que un estudiante autenticado puede reservar una clase disponible, verificar la actualización automática del aforo a 1/8 inscritos y generar su Pase Digital de Acceso QR interactivo.",
            "precondiciones": "Alumno autenticado (benjamin60821@gmail.com) con suscripción activa y saldo de créditos positivo.",
            "pasos": [
                "1. Iniciar sesión como Alumno y acceder a la sección /alumno/explorar.",
                "2. Localizar la clase de Pole Dance (18:30 hrs, Sala A) y presionar 'Reservar cupo'.",
                "3. Verificar la notificación de confirmación y el cambio del contador de aforo a 1/8 inscritos.",
                "4. Navegar a /alumno/mis-clases y comprobar que la sesión figura en la lista de clases reservadas.",
                "5. Presionar el botón 'Check-in QR' para desplegar el código bidimensional dinámico generado para el aula."
            ],
            "resultado_esperado": "La reserva se registra en BD, el aforo se incrementa a 1/8, se descuenta 1 crédito y se genera el código QR único.",
            "resultado_obtenido": "Reserva confirmada con éxito, aforo actualizado a 1/8 (7 libres) y modal QR emitido correctamente.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-02_01_Horario_Alumno.png", "Evidencia CP-02.1: Card de la clase en agenda del alumno lista para reservar."),
                ("CP-02_02_Reserva_Confirmada.png", "Evidencia CP-02.2: Confirmación interactiva de reserva confirmada en la aplicación."),
                ("CP-02_03_Aforo_1_de_8.png", "Evidencia CP-02.3: Actualización en tiempo real del aforo a 1/8 inscritos."),
                ("CP-02_04_Mis_Clases.png", "Evidencia CP-02.4: Sección 'Mis Clases' con reserva confirmada y botón 'Check-in QR'."),
                ("CP-02_05_Pase_QR.png", "Evidencia CP-02.5: Modal interactivo con código QR dinámico de acceso al aula.")
            ]
        },
        {
            "id": "CP-03",
            "titulo": "Validaciones de Negocio: Bloqueo de Duplicados y Límite de Aforo",
            "folder": "CP-03_Validaciones",
            "modulo": "Reglas de Negocio e Integridad de Cupos",
            "objetivo": "Verificar que el sistema bloquea intentos de reservas duplicadas por el mismo alumno e impide sobrepasar el aforo máximo permitido (8 cupos) cuando una clase se encuentra al 100% de ocupación.",
            "precondiciones": "Existencia de una clase ya reservada por el usuario y una segunda sesión con cupo completo (8/8 inscritos).",
            "pasos": [
                "1. Acceder con el alumno al catálogo e intentar pulsar nuevamente 'Reservar' sobre su clase ya agendada.",
                "2. Observar la respuesta del sistema ante la duplicación.",
                "3. Localizar una clase con 8/8 inscritos ('Pole Exotic Avanzado').",
                "4. Intentar agendar cupo sobre la clase que ha alcanzado su capacidad máxima."
            ],
            "resultado_esperado": "El sistema bloquea la acción duplicada mostrando 'Ya reservada' y deshabilita la clase completa con badge '100% — COMPLETO'.",
            "resultado_obtenido": "Validaciones operativas aprobadas: el sistema prohíbe duplicidades y rechaza reservas en clases llenas.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-03_01_Reserva_Duplicada.png", "Evidencia CP-03.1: Bloqueo de duplicidad de reserva para un mismo usuario y clase."),
                ("CP-03_02_Aforo_Completo.png", "Evidencia CP-03.2: Bloqueo de reserva por aforo completo al 100% (8/8 cupos ocupados).")
            ]
        },
        {
            "id": "CP-04",
            "titulo": "Cancelación por el Profesor y Regla de 2 Horas de Anticipación",
            "folder": "CP-04_Cancelacion_Profesor",
            "modulo": "Gestión Docente y Cancelación Consciente",
            "objetivo": "Evaluar el flujo de suspensión de clase por parte del docente con motivo fundamentado, la aplicación de la regla de 2 horas de anticipación ('Cancelación Consciente') y la restitución automática del crédito al estudiante.",
            "precondiciones": "Profesor con clase programada y alumnos previamente inscritos.",
            "pasos": [
                "1. Docente ingresa a /profesor/dashboard y hace clic en 'Aviso / Cancelar' en la tarjeta de la clase.",
                "2. Se despliega el modal 'Gestión Rápida de Ausencia', donde escribe el motivo (ej. fuerza mayor médica).",
                "3. El sistema valida que el aviso se realice con más de 2 horas de anticipación conforme a la política institucional.",
                "4. Al pulsar 'Activar Relevo Inmediato', Coordinación recibe el reporte y el alumno es informado.",
                "5. Se comprueba que el crédito del alumno fue devuelto a su saldo y el cupo quedó liberado."
            ],
            "resultado_esperado": "Se permite la cancelación dentro del plazo de anticipación, se genera alerta para administración y se restituye el crédito al alumno.",
            "resultado_obtenido": "Flujo de cancelación validado con éxito: motivo registrado, regla de 2 horas comunicada y crédito reembolsado.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-04_01_Profesor_Cancela_Clase.png", "Evidencia CP-04.1: Modal docente 'Gestión Rápida de Ausencia' con campo de motivo."),
                ("CP-04_02_Regla_2_Horas_Anticipacion.png", "Evidencia CP-04.2: Política de Cancelación Consciente (2 horas de anticipación para restitución)."),
                ("CP-04_03_Notificacion_Profesor.png", "Evidencia CP-04.3: Notificación de suspensión y estado 'Buscando suplente'."),
                ("CP-04_04_Devolucion_Credito_Y_Cupo.png", "Evidencia CP-04.4: Restitución automática de créditos y liberación de cupos del alumno.")
            ]
        },
        {
            "id": "CP-05",
            "titulo": "Búsqueda y Asignación de Profesor Reemplazante (Admin)",
            "folder": "CP-05_Reemplazo_Profesor",
            "modulo": "Coordinación Académica y Gestión de Suplencias",
            "objetivo": "Comprobar que ante una solicitud de ausencia docente, el Administrador puede consultar los profesores activos disponibles en la academia y asignar un reemplazo, garantizando la continuidad de la clase.",
            "precondiciones": "Alerta crítica de reemplazo recibida en la bandeja del Administrador.",
            "pasos": [
                "1. Administrador accede a /admin/notificaciones y revisa la alerta 'Solicitud de Relevo Docente'.",
                "2. Se dirige a la pestaña 'Equipo Docente' (/admin/clases?tab=staff) para verificar profesores activos (Camila Pole, Valentina Flex).",
                "3. Asigna al docente de reemplazo para la franja horaria correspondiente.",
                "4. El sistema actualiza la clase y notifica a los alumnos inscritos que su clase sigue confirmada."
            ],
            "resultado_esperado": "La clase se reasigna al nuevo docente sin cancelar las reservas existentes de los alumnos.",
            "resultado_obtenido": "Relevo asignado satisfactoriamente manteniendo intacta la matrícula de estudiantes.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-05_01_Admin_Alerta_Profesor_Ausente.png", "Evidencia CP-05.1: Alerta crítica de relevo docente en /admin/notificaciones."),
                ("CP-05_02_Profesores_Disponibles.png", "Evidencia CP-05.2: Nómina de docentes activos de la academia disponibles para suplencia."),
                ("CP-05_03_Reemplazo_Asignado.png", "Evidencia CP-05.3: Modal de clase reflejando la asignación del nuevo profesor a cargo.")
            ]
        },
        {
            "id": "CP-06",
            "titulo": "Cancelación Definitiva por Falta de Reemplazo y Reembolso",
            "folder": "CP-06_Cancelacion_Sin_Reemplazo",
            "modulo": "Cancelación en Cascada y Reembolso Atómico",
            "objetivo": "Verificar el flujo de contingencia cuando no es posible encontrar un docente de reemplazo, requiriendo la cancelación definitiva de la clase, el borrado seguro en cascada y la restitución atómica de créditos.",
            "precondiciones": "Clase con reservas que debe ser dada de baja por Coordinación.",
            "pasos": [
                "1. Administrador accede a las sesiones del calendario en /admin/clases?tab=calendar.",
                "2. Presiona el botón de eliminar sesión sobre la clase sin reemplazo disponible.",
                "3. El sistema muestra diálogo de advertencia informando la cancelación de reservas y reembolso automático.",
                "4. Se ejecuta la función deleteClassesCascade en base de datos.",
                "5. Se verifica en el perfil del alumno que su crédito fue devuelto a creditos_restantes."
            ],
            "resultado_esperado": "La sesión se elimina del calendario, se eliminan asistencias y se reembolsan los créditos a todos los inscritos.",
            "resultado_obtenido": "Eliminación en cascada ejecutada sin errores; créditos reintegrados a las cuentas de los alumnos.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-06_01_Admin_Sin_Reemplazo.png", "Evidencia CP-06.1: Sesión en calendario seleccionada para baja administrativa."),
                ("CP-06_02_Clase_Cancelada_Estado.png", "Evidencia CP-06.2: Diálogo de confirmación de eliminación con reembolso automático."),
                ("CP-06_03_Devolucion_Creditos_Cascada.png", "Evidencia CP-06.3: Saldo de créditos restituido verificado en la cuenta del alumno.")
            ]
        },
        {
            "id": "CP-07",
            "titulo": "Inicio de Clase por Profesor y Notificación Operativa",
            "folder": "CP-07_Inicio_Clase",
            "modulo": "Operación de Aula en Vivo",
            "objetivo": "Validar que el profesor puede dar inicio formal a la sesión mediante el botón 'Comenzar Clase', cambiando el estado a 'EN CURSO', registrando la hora de apertura y notificando automáticamente a la administración.",
            "precondiciones": "Docente con clase asignada abierta en /profesor/clase/[id].",
            "pasos": [
                "1. El profesor abre la pantalla interactiva de la sesión (/profesor/clase/63).",
                "2. Presiona el botón destacado 'Comenzar Clase'.",
                "3. El badge superior muta de 'PROGRAMADA' a 'EN CURSO' con indicador luminoso pulsante.",
                "4. Se inserta en la tabla notificaciones el registro operativo indicando apertura y aforo inicial.",
                "5. Se comprueba que el inicio opera tanto con alumnos en espera como en clase iniciada previamente."
            ],
            "resultado_esperado": "El estado de la clase pasa a 'en_curso', se emite alerta a recepción y se habilita el control de asistencia.",
            "resultado_obtenido": "Clase iniciada en tiempo real; evento registrado en base de datos y visible en administración.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-07_01_Profesor_Inicia_Clase.png", "Evidencia CP-07.1: Pantalla interactiva del docente con botón 'Comenzar Clase'."),
                ("CP-07_02_Estado_En_Curso.png", "Evidencia CP-07.2: Estado de clase actualizado a badge pulsante verde 'EN CURSO'."),
                ("CP-07_03_Notificacion_Inicio_Admin.png", "Evidencia CP-07.3: Notificación operativa 'Clase Iniciada' recibida por el Administrador."),
                ("CP-07_04_Clase_Sin_Alumnos_Inicio.png", "Evidencia CP-07.4: Validación de inicio operativo con alumnos pendientes de ingreso.")
            ]
        },
        {
            "id": "CP-08",
            "titulo": "Control de Asistencia en Tiempo Real: Validación QR y Check-in Manual",
            "folder": "CP-08_Asistencia",
            "modulo": "Control de Acceso y Trazabilidad de Asistencia",
            "objetivo": "Probar el registro progresivo de asistencia durante la clase mediante escaneo QR y marcación manual de contingencia, almacenando el timestamp exacto de ingreso de cada alumno y visualizando datos médicos.",
            "precondiciones": "Clase en curso con alumnos inscritos en estado pendiente.",
            "pasos": [
                "1. En /profesor/clase/63, el docente activa el escáner o presiona 'Simular Pase'.",
                "2. El sistema decodifica el token, valida reserva y clase, y registra el ingreso en la tabla asistencia.",
                "3. El alumno cambia a estado 'Presente' con badge verde y se registra la hora exacta.",
                "4. Se prueba el botón 'Marcar' para check-in manual en caso de falla de dispositivo del alumno.",
                "5. Se despliega la ficha del alumno para consultar contacto de emergencia y condiciones médicas."
            ],
            "resultado_esperado": "Asistencia registrada en BD con método ('QR' o 'Manual') y hora exacta; róster actualizado en vivo.",
            "resultado_obtenido": "Asistencia registrada al instante por ambos métodos; ficha médica y contactos accesibles.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-08_01_Validacion_Ingreso_QR.png", "Evidencia CP-08.1: Interfaz de validación de acceso con escáner QR en vivo."),
                ("CP-08_02_CheckIn_Manual_Docente.png", "Evidencia CP-08.2: Marcación interactiva y confirmación toast de ingreso de alumno."),
                ("CP-08_03_Roster_Presentes_Trazabilidad.png", "Evidencia CP-08.3: Róster con estado 'Presente', timestamp de ingreso y datos de emergencia.")
            ]
        },
        {
            "id": "CP-09",
            "titulo": "Cierre de Clase y Gestión de Incidencias de Sala",
            "folder": "CP-09_Cierre_Clase",
            "modulo": "Cierre de Jornada y Protocolo de Incidencias",
            "objetivo": "Demostrar la finalización de la clase con balance consolidado de asistencia (presentes vs ausentes) y la disponibilidad del protocolo de reporte de incidentes en sala para comunicación ágil con recepción.",
            "precondiciones": "Clase en curso con control de asistencia efectuado.",
            "pasos": [
                "1. El profesor revisa la barra de progreso de asistencia (100% completada).",
                "2. Utiliza la pestaña 'Mostrar QR' para permitir escaneo inverso de alumnos rezagados.",
                "3. Presiona 'Notificar Incidencia de Sala' para reportar eventualidades (retrasos, averías, temas médicos).",
                "4. Se verifica el envío del aviso sin saturar notificaciones individuales por cada minuto de clase."
            ],
            "resultado_esperado": "Balance final de asistencia consolidado y reporte preventivo de incidencias operativo.",
            "resultado_obtenido": "Cierre ordenado de sesión y protocolo de incidencias de sala verificado con éxito.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-09_01_Resumen_Asistencia_Final.png", "Evidencia CP-09.1: Barra de progreso al 100% y modo de proyección de QR en aula."),
                ("CP-09_02_Reporte_Incidencia_Sala.png", "Evidencia CP-09.2: Modal interactivo de notificación de incidencias operativas de sala.")
            ]
        },
        {
            "id": "CP-10",
            "titulo": "Auditoría Centralizada y Monitoreo Nocturno (Admin)",
            "folder": "CP-10_Auditoria_Admin",
            "modulo": "Auditoría y Control de Gestión",
            "objetivo": "Validar que la administración puede ingresar en cualquier momento (ej. en la noche) a la bandeja de notificaciones para auditar las clases impartidas, verificar la asistencia real vs inscritos y consultar notas.",
            "precondiciones": "Sesiones del día finalizadas o en curso con registros de asistencia en la base de datos.",
            "pasos": [
                "1. Administrador inicia sesión e ingresa a /admin/notificaciones.",
                "2. Consulta el historial cronológico de eventos operativos y críticos.",
                "3. Presiona 'Ver Clase' en la tarjeta del evento para abrir el modal de auditoría nocturna.",
                "4. Revisa métricas: Estado ('EN CURSO' / 'PROGRAMADA'), Sala, Profesor, Cupos utilizados (1/8) y Alumnos presentes (1 presentes de 1 inscritos)."
            ],
            "resultado_esperado": "El Administrador obtiene trazabilidad fehaciente de la asistencia efectiva y control de la jornada.",
            "resultado_obtenido": "Auditoría nocturna verificada con total coherencia entre base de datos e interfaz administrativa.",
            "estado": "✅ Aprobado",
            "evidencias": [
                ("CP-10_01_Bandeja_Notificaciones_Admin.png", "Evidencia CP-10.1: Bandeja centralizada de eventos y alertas en /admin/notificaciones."),
                ("CP-10_02_Modal_Detalle_Clase_Admin.png", "Evidencia CP-10.2: Modal de auditoría con desglose de cupos, presentes efectivos y profesor."),
                ("CP-10_03_Trazabilidad_Y_Notas.png", "Evidencia CP-10.3: Detalle consolidado de métricas operativas para control de gestión.")
            ]
        }
    ]

    for caso in casos_detalle:
        add_heading_styled(doc, f"3.{caso['id'][3:]} {caso['id']} — {caso['titulo']}", level=2)
        
        # Tabla resumen del caso de prueba
        t_cp = doc.add_table(rows=7, cols=2)
        t_cp.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        campos = [
            ("Módulo Evaluado:", caso["modulo"]),
            ("Objetivo:", caso["objetivo"]),
            ("Precondiciones:", caso["precondiciones"]),
            ("Pasos de Ejecución:", "\n".join(caso["pasos"])),
            ("Resultado Esperado:", caso["resultado_esperado"]),
            ("Resultado Obtenido:", caso["resultado_obtenido"]),
            ("Evaluación Final:", caso["estado"])
        ]
        
        for idx, (lbl, val) in enumerate(campos):
            r = t_cp.rows[idx]
            is_eval = (idx == 6)
            set_cell_font(r.cells[0], lbl, bold=True, color_rgb=(31, 56, 100), size_pt=8.5)
            set_cell_bg(r.cells[0], "F2F4F8")
            set_cell_margins(r.cells[0], 50, 50, 80, 80)
            
            val_color = (0, 128, 0) if is_eval else (40, 40, 40)
            set_cell_font(r.cells[1], val, bold=is_eval, color_rgb=val_color, size_pt=8.5)
            set_cell_bg(r.cells[1], "FFFFFF" if idx % 2 == 0 else "F9FAFC")
            set_cell_margins(r.cells[1], 50, 50, 80, 80)

        # Incrustar evidencias fotográficas
        add_heading_styled(doc, f"Evidencias Fotográficas de Ejecución ({caso['id']}):", level=3)
        folder_path = os.path.join(evidencias_dir, caso["folder"])
        
        for img_name, caption in caso["evidencias"]:
            img_path = os.path.join(folder_path, img_name)
            if os.path.exists(img_path):
                p_img = doc.add_paragraph()
                p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_img.paragraph_format.space_before = Pt(6)
                p_img.paragraph_format.space_after = Pt(2)
                run_img = p_img.add_run()
                
                # Ajustar ancho de imagen según orientación
                if "Admin" in img_name or "Crear_Horario" in img_name or "Horario_Creado" in img_name:
                    run_img.add_picture(img_path, width=Inches(5.6))
                else:
                    run_img.add_picture(img_path, width=Inches(3.3))
                
                # Epígrafe
                p_cap = doc.add_paragraph()
                p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_cap.paragraph_format.space_after = Pt(10)
                run_cap = p_cap.add_run(caption)
                run_cap.font.name = "Calibri"
                run_cap.font.size = Pt(8.0)
                run_cap.font.italic = True
                run_cap.font.color.rgb = RGBColor(100, 100, 100)
            else:
                p_err = doc.add_paragraph()
                run_err = p_err.add_run(f"[Captura pendiente: {img_name}]")
                run_err.font.color.rgb = RGBColor(200, 0, 0)

    # -------------------------------------------------------------
    # 4. CONCLUSIONES TÉCNICAS Y CONFORMIDAD DE REGLAS DE NEGOCIO
    # -------------------------------------------------------------
    add_heading_styled(doc, "4. Conclusiones y Trazabilidad de Reglas de Negocio", level=1)
    
    p_concl = doc.add_paragraph()
    p_concl.paragraph_format.line_spacing = 1.15
    p_concl.paragraph_format.space_after = Pt(8)
    p_concl.add_run(
        "La batería de testing de la Fase 3 concluye con una tasa de éxito del 100% (10 de 10 casos de prueba aprobados). "
        "Se verificó con rigor técnico la robustez del sistema en sus diferentes capas arquitectónicas:\n\n"
        "1. Regla de Aforo Estricto: El sistema protege la integridad del cupo máximo (8 alumnos por sala), actualizando en tiempo real "
        "las vacantes y bloqueando cualquier intento de sobrecupo o duplicidad de reserva.\n\n"
        "2. Política de Cancelación Consciente (2 Horas): Se validó que las solicitudes de suspensión respeten el plazo mínimo de aviso institucional, "
        "garantizando la restitución automática de créditos y la reapertura inmediata de cupos.\n\n"
        "3. Trazabilidad de Asistencia QR: La lectura e inserción en base de datos opera de manera atómica, registrando timestamp de acceso y método "
        "sin generar saturación de notificaciones innecesarias en la plataforma.\n\n"
        "4. Auditoría Nocturna Centralizada: La administración cuenta con visibilidad completa de asistencias reales versus alumnos inscritos, "
        "con notas de contingencia y control de gestión consolidado."
    )

    # GUARDAR DOCUMENTO
    output_docx_path = os.path.join(base_dir, 'Informe_Testing.docx')
    try:
        doc.save(output_docx_path)
        print(f"Informe Word generado exitosamente en: {output_docx_path}")
    except PermissionError:
        alt_path = os.path.join(base_dir, 'Informe_Testing_Fase3_Completo.docx')
        doc.save(alt_path)
        print(f"El archivo 'Informe_Testing.docx' está abierto en Word. Se guardó como: {alt_path}")


if __name__ == "__main__":
    create_full_informe_testing()
