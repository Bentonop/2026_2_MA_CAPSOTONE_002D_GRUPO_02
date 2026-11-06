# Ritmo Studio - Cuerpo y Alma 🩰✨

Plataforma integral para la gestión de academias de danza y disciplinas afines. Este sistema permite conectar a los administradores, profesores y alumnos en un entorno digital moderno, facilitando la reserva de clases, la gestión de suscripciones y el control del equipo docente.

## 🚀 Roles de la Aplicación

El sistema cuenta con tres tipos de perfiles, cada uno con paneles e interfaces exclusivas:

1. **Administrador (`/admin`)**
   - **Gestión Academia:** Control centralizado de todo el estudio. Aquí el admin crea "Tipos de Disciplina", define "Salas", revisa el calendario semanal (Master Schedule) y administra el equipo docente (ascender alumnos a profesores o darlos de baja).
   - **Alumnos y Directorio:** Visualización del progreso de los alumnos, sus datos de contacto y **Fichas Médicas** (condiciones o números de emergencia).
   - **Planes y Suscripciones:** Validación de comprobantes de pago (transferencias manuales) y asignación de créditos.

2. **Profesor (`/profesor`)**
   - **Mi Agenda:** Visualización de los bloques de horario asignados y la sala en la que deben dictar sus clases.
   - **Toma de Asistencia:** Lector de códigos QR integrado o lista manual para confirmar la llegada de los alumnos a la clase.

3. **Alumno (`/alumno`)**
   - **Explorar:** Interfaz para buscar y unirse a clases disponibles según sus créditos.
   - **Mi Código QR:** Tarjeta de membresía digital para facilitar el acceso presencial.
   - **Tienda / Suscripciones:** Renovación de planes de clases mensuales.

## 🛠️ Stack Tecnológico

- **Frontend:** [Next.js](https://nextjs.org/) (React) + [Tailwind CSS](https://tailwindcss.com/)
- **Backend / Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Diseño UI:** Componentes de alto contraste inspirados en tendencias "Neobank" e interfaces minimalistas Premium (Modo Oscuro, acentos dorados).

## ⚙️ Configuración e Instalación Local

Para que cualquier miembro del equipo pueda levantar el proyecto en su máquina, deben seguir estos pasos:

### 1. Requisitos Previos
- Instalar **Node.js** (v18 o superior).
- Solicitar al administrador las credenciales del entorno de **Supabase**.

### 2. Instalación
Clona el repositorio e ingresa a la carpeta del proyecto para instalar las dependencias:
```bash
git clone https://github.com/Bentonop/2026_2_MA_CAPSOTONE_002D_GRUPO_02.git
cd "2026_2_MA_CAPSOTONE_002D_GRUPO_02/Fase 2/Evidencias Proyecto/Evidencias de sistema Aplicacion/Proyecto"
npm install
```

### 3. Base de Datos (Scripts SQL)
En las siguientes carpetas encontrarás los archivos `.sql` correspondientes:
- `Fase 2/Evidencias Proyecto/Evidencias de sistema Aplicacion/Base de datos/` (`full_database_setup.sql`, `rls_politicas_seguridad.sql`)
- `Fase 2/Evidencias Proyecto/Evidencias de sistema Aplicacion/Proyecto/database_scripts/` (`planes.sql`, `pagos.sql`, `salas.sql`, `ficha_medica.sql`, `demo_seed.sql`, etc.)

Estos archivos son el esqueleto de la base de datos. Si estás montando una base de datos desde cero, **debes ejecutar el contenido de estos archivos** en el *SQL Editor* de Supabase.

### 4. Variables de Entorno
Crea un archivo llamado `.env.local` dentro de la carpeta del proyecto (`Fase 2/Evidencias Proyecto/Evidencias de sistema Aplicacion/Proyecto/`) y añade las claves de Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
```

### 5. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

## 🤝 Flujo de Trabajo del Equipo (Obligatorio)

Para mantener la estabilidad del código, todo el equipo debe seguir la metodología **GitHub Flow**.
Por favor, lee el archivo [**CONTRIBUTING.md**](./Fase%202/Evidencias%20Proyecto/Evidencias%20de%20sistema%20Aplicacion/Proyecto/CONTRIBUTING.md) antes de empezar a programar. Allí se detalla cómo crear ramas, cómo nombrar los commits y cómo hacer Pull Requests. **NUNCA subas cambios directamente a `main`.**
