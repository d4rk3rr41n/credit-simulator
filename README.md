# Simulador de Créditos y Copropiedad

Aplicación web interactiva para simular planes de pagos de créditos (**Vehicular**, **Libre Inversión**, **Hogar / Vivienda** u otros), proyectar estrategias de **abonos extraordinarios a capital** y calcular el **porcentaje real de propiedad** cuando un bien o préstamo se paga entre dos o más personas.

Funciona **100% en el navegador sin necesidad de servidor ni dependencias externas**: basta con abrir el archivo `index.html`.

---

## Características Principales

- **Modos Sencillo y Pro:**
  - **Sencillo:** Vista minimalista con los indicadores esenciales y la tabla de pagos limpia.
  - **Pro:** Incluye gráficas vectoriales (curva de saldo de capital y distribución del dinero), comparador automático de 3 estrategias, desglose de intereses/seguros y columnas individuales por participante.
- **Cálculo de Copropiedad entre Varias Personas:**
  - Permite registrar el aporte de cada participante en **cuota inicial**, **costo de papeles (matrícula/traspaso)**, **pago mensual** y **abonos extraordinarios**.
  - Calcula tanto el **% del Bien (por Capital)** como el **% por Bolsillo (Gasto Total)** y muestra cuánto falta para equilibrar partes iguales (ej. 50% / 50%).
  - **Deuda interna justa:** Reduce proporcionalmente los intereses mensuales internos a quien realice mayores abonos extraordinarios a capital.
- **Estrategias de Abonos Extraordinarios:**
  - Soporte para **Reducción de Plazo** o **Reducción de Cuota**.
  - Abonos extra fijos o basados en presupuesto mensual total, primas semestrales (Junio / Diciembre) y **abonos puntuales personalizados por persona** en cualquier cuota de la tabla.
- **Seguros y Cargos por Rango de Meses:**
  - Permite definir desde qué cuota inicia y hasta qué cuota termina cada seguro mensual (ideal para simular el seguro inicial del banco durante el primer año y el cambio a una póliza endosada más económica desde el mes 13 hasta el final).
- **Simulador de Compra de Cartera:**
  - Evalúa cuánto ahorrarías trasladando el saldo de la deuda en cualquier cuota hacia otro banco con una tasa de interés menor (`% M.V.` / `% E.A.`).
- **Gestión de Escenarios, CSV y PDF:**
  - Guardado automático en el navegador (`localStorage`) e historial **Deshacer / Rehacer** (`Ctrl+Z` / `Ctrl+Y`).
  - Selector de escenarios guardados identificados con símbolo según el tipo de crédito (**Vehicular**, **Libre Inversión**, **Hogar**, **Otro**) y **Comparador Lado a Lado** entre escenarios.
  - **Importación y Exportación en CSV** para respaldar o compartir casos completos.
  - Generación de reporte limpio para imprimir o guardar en **PDF**.
- **Glosario Financiero Integrado:**
  - Panel desplegable con buscador y filtros por categoría que explica de forma sencilla los conceptos financieros clave (*Capital*, *Tasa M.V.*, *Tasa E.A.*, *Amortización Francesa*, *Endoso de Póliza*, *Compra de Cartera*, entre otros).

---

## Estructura del Proyecto

```text
simulador-creditos/
├── index.html          # Interfaz principal (ejecutable directamente en el navegador)
├── styles.css          # Estilos (tema oscuro y claro, diseño responsivo y vista de impresión PDF)
├── js/
│   ├── state.js        # Estado global, constantes, iconos SVG, historial (Undo/Redo) y glosario
│   ├── engine.js       # Motor matemático de amortización francesa, seguros, copropiedad y compra de cartera
│   ├── storage.js      # Persistencia en localStorage, gestión de escenarios e importación/exportación CSV
│   ├── charts.js       # Gráficas vectoriales SVG y comparador visual del modo Pro
│   └── ui.js           # Renderizado del DOM, modales, eventos e interacciones de teclado
└── tests/
    └── engine.test.js  # Suite de pruebas automatizadas del motor financiero
```

---

## Cómo Usarlo

1. Clona o descarga este repositorio.
2. Abre el archivo **`index.html`** con doble clic en cualquier navegador moderno (Chrome, Edge, Firefox, Safari).
3. Ingresa los datos de tu crédito desde `0`, crea un **Nuevo escenario** desde la barra superior o haz clic en **Importar CSV** para cargar un escenario guardado.

### Ejecutar las pruebas automatizadas (Opcional)

Si tienes [Node.js](https://nodejs.org/) instalado, puedes verificar los cálculos matemáticos del motor ejecutando:

```bash
node tests/engine.test.js
```

---

## Autor

Hecho por **Julian Pinzon** — [GitHub (@d4rk3rr41n)](https://github.com/d4rk3rr41n)
