// --- Color Picker Logic ---

// DOM Elements
let colorPickerMenu,
    colorPickerSquare,
    colorPickerPointer,
    colorPickerSlider,
    redInput, greenInput, blueInput,
    hueInput, saturationInput, luminosityInput,
    hexInput,
    editColorElement,
    applyColorButton,
    resetColorButton,
    closeColorPickerButton;

// State
let currentColor = { h: 0, s: 1, l: 0.5 }; // HSL color model
let initialColor = '';
let onApplyCallback = null;
// new: picker mode ('hue' | 'saturation' | 'luminosity')
let pickerMode = 'hue';

// export setter so UI can toggle modes (e.g. radio buttons)
export function setColorPickerMode(mode) {
    const valid = ['hue', 'saturation', 'luminosity', 'red', 'green', 'blue'];
    if (!valid.includes(mode)) return;
    pickerMode = mode;
    if (colorPickerMenu) {
        updateSliderMode();
        updateUI();
    }
}

/**
 * Initializes the color picker, gets DOM elements, and sets up event listeners.
 */
export function initializeColorPicker() {
    // Get DOM elements
    colorPickerMenu = document.getElementById('color-picker-menu');
    colorPickerSquare = document.getElementById('color-picker-square');
    colorPickerPointer = document.getElementById('color-picker-pointer');
    colorPickerSlider = document.getElementById('color-picker-slider');
    redInput = document.getElementById('red-amount-input');
    greenInput = document.getElementById('green-amount-input');
    blueInput = document.getElementById('blue-amount-input');
    hueInput = document.getElementById('hue-amount-input');
    saturationInput = document.getElementById('saturation-amount-input');
    luminosityInput = document.getElementById('luminosity-amount-input');
    hexInput = document.getElementById('hex-input');
    editColorElement = document.getElementById('edit-color-element');
    applyColorButton = document.getElementById('apply-color-button');
    resetColorButton = document.getElementById('reset-color-button');
    closeColorPickerButton = document.getElementById('close-color-picker-menu');

    // Ensure hue range is 0-360
    if (colorPickerSlider) {
        colorPickerSlider.min = 0;
        colorPickerSlider.max = 360;
        colorPickerSlider.step = 1;
    }
    if (redInput) {
        redInput.min = 0;
        redInput.max = 255;
    }
    if (greenInput) {
        greenInput.min = 0;
        greenInput.max = 255;
    }
    if (blueInput) {
        blueInput.min = 0;
        blueInput.max = 255;
    }
    if (hueInput) {
        hueInput.min = 0;
        hueInput.max = 360;
    }
    if (saturationInput) {
        saturationInput.min = 0;
        saturationInput.max = 100;
    }
    if (luminosityInput) {
        luminosityInput.min = 0;
        luminosityInput.max = 100;
    }

    // wire radio buttons to pickerMode
    const radios = document.querySelectorAll('input[name="color-input-type"]');
    radios.forEach(r => {
        r.addEventListener('change', () => {
            if (!r.checked) return;
            const val = r.value;
            setColorPickerMode(val);
            updateUI();
        });
    });

    // Ensure initial mode matches whichever radio is checked in the DOM
    const checked = document.querySelector('input[name="color-input-type"]:checked');
    if (checked) setColorPickerMode(checked.value);

    // Ensure slider mode matches initial pickerMode
    updateSliderMode();

    // Setup event listeners
    setupEventListeners();
}

// New helper: configure slider min/max/value/visuals per mode
function updateSliderMode() {
    if (!colorPickerSlider) return;
    const satPct = `${Math.round(currentColor.s * 100)}%`;
    const lumPct = `${Math.round(currentColor.l * 100)}%`;
    const hueDeg = Math.round(currentColor.h * 360);
    let gradient = '';
    if (pickerMode === 'hue') {
        colorPickerSlider.min = 0;
        colorPickerSlider.max = 360;
        colorPickerSlider.step = 1;
        colorPickerSlider.value = hueDeg;
        gradient = `linear-gradient(to right,
            hsl(0,${satPct},${lumPct}),
            hsl(60,${satPct},${lumPct}),
            hsl(120,${satPct},${lumPct}),
            hsl(180,${satPct},${lumPct}),
            hsl(240,${satPct},${lumPct}),
            hsl(300,${satPct},${lumPct}),
            hsl(360,${satPct},${lumPct})
        )`;
    } else if (pickerMode === 'saturation') {
        colorPickerSlider.min = 0;
        colorPickerSlider.max = 100;
        colorPickerSlider.step = 1;
        colorPickerSlider.value = Math.round(currentColor.s * 100);
        // gradient: for current hue, saturation from 0% -> 100%
        gradient = `linear-gradient(to right, hsl(${hueDeg}, 0%, ${lumPct}), hsl(${hueDeg}, 100%, ${lumPct}))`;
    } else if (pickerMode === 'red' || pickerMode === 'green' || pickerMode === 'blue') {
        const rgbNow = hslToRgb(currentColor.h, currentColor.s, currentColor.l);
        if (pickerMode === 'red') {
            colorPickerSlider.min = 0;
            colorPickerSlider.max = 255;
            colorPickerSlider.step = 1;
            colorPickerSlider.value = rgbNow.r;
            // gradient: red channel from 0 -> 255 while keeping current G/B
            gradient = `linear-gradient(to right, rgb(0, ${rgbNow.g}, ${rgbNow.b}), rgb(255, ${rgbNow.g}, ${rgbNow.b}))`;
        } else if (pickerMode === 'green') {
            colorPickerSlider.min = 0;
            colorPickerSlider.max = 255;
            colorPickerSlider.step = 1;
            colorPickerSlider.value = rgbNow.g;
            // gradient: green channel from 0 -> 255 while keeping current R/B
            gradient = `linear-gradient(to right, rgb(${rgbNow.r}, 0, ${rgbNow.b}), rgb(${rgbNow.r}, 255, ${rgbNow.b}))`;
        } else { // blue
            colorPickerSlider.min = 0;
            colorPickerSlider.max = 255;
            colorPickerSlider.step = 1;
            colorPickerSlider.value = rgbNow.b;
            // gradient: blue channel from 0 -> 255 while keeping current R/G
            gradient = `linear-gradient(to right, rgb(${rgbNow.r}, ${rgbNow.g}, 0), rgb(${rgbNow.r}, ${rgbNow.g}, 255))`;
        }
    } else { // luminosity
        colorPickerSlider.min = 0;
        colorPickerSlider.max = 100;
        colorPickerSlider.step = 1;
        colorPickerSlider.value = Math.round(currentColor.l * 100);
        // gradient: for current hue, luminosity from 0% -> 100%
        gradient = `linear-gradient(to right, hsl(${hueDeg}, ${satPct}, 0%), hsl(${hueDeg}, ${satPct}, 50%), hsl(${hueDeg}, ${satPct}, 100%))`;
    }

    // Apply gradient as a CSS variable so pseudo-element tracks update, keep inline background as fallback
    colorPickerSlider.style.setProperty('--color-picker-slider-bg', gradient);
    colorPickerSlider.style.background = gradient;
}

/**
 * Opens the color picker modal.
 * @param {string} colorString - The initial color in hex format (e.g., "#RRGGBB").
 * @param {string} elementName - The name of the element being edited.
 * @param {function} callback - The function to call when 'Apply' is clicked.
 */
export function openColorPicker(colorString, elementName, callback) {
    initialColor = colorString;
    onApplyCallback = callback;
    editColorElement.textContent = elementName;

    const rgb = hexToRgb(colorString);
    if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        currentColor = hsl;
    }

    updateUI();

    document.getElementById('overlay-backdrop3').classList.remove('hidden');
    colorPickerMenu.classList.remove('hidden');
}

function closeColorPicker() {
    document.getElementById('overlay-backdrop3').classList.add('hidden');
    colorPickerMenu.classList.add('hidden');
}

function setupEventListeners() {
    // Slider and Square dragging
    let isDraggingSquare = false;
    let isDraggingSlider = false;

    const startDragSquare = (e) => {
        isDraggingSquare = true;
        updateColorFromSquare(e);
    };

    const drag = (e) => {
        if (isDraggingSquare) updateColorFromSquare(e);
        if (isDraggingSlider) updateColorFromSlider();
    };

    const stopDrag = () => {
        isDraggingSquare = false;
        isDraggingSlider = false;
    };

    colorPickerSquare.addEventListener('mousedown', startDragSquare);
    colorPickerSquare.addEventListener('touchstart', (e) => { e.preventDefault(); startDragSquare(e.touches[0]); });

    colorPickerSlider.addEventListener('mousedown', () => isDraggingSlider = true);
    colorPickerSlider.addEventListener('touchstart', () => isDraggingSlider = true);

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', (e) => drag(e.touches[0]));

    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
    
    colorPickerSlider.addEventListener('input', updateColorFromSlider);

    // Input fields
    [redInput, greenInput, blueInput].forEach(input => input.addEventListener('input', updateColorFromRGB));
    [hueInput, saturationInput, luminosityInput].forEach(input => input.addEventListener('input', updateColorFromHSL));
    hexInput.addEventListener('input', updateColorFromHex);

    // Buttons
    applyColorButton.addEventListener('click', () => {
        if (onApplyCallback) {
            const rgb = hslToRgb(currentColor.h, currentColor.s, currentColor.l);
            onApplyCallback(rgbToHex(rgb.r, rgb.g, rgb.b));
        }
        closeColorPicker();
    });

    resetColorButton.addEventListener('click', () => {
        const rgb = hexToRgb(initialColor);
        if (rgb) {
            currentColor = rgbToHsl(rgb.r, rgb.g, rgb.b);
            updateUI();
        }
    });

    closeColorPickerButton.addEventListener('click', closeColorPicker);
}

// --- Update Functions ---

function updateColorFromSquare(e) {
    const rect = colorPickerSquare.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = (e.clientY - rect.top) / rect.height;

    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    // map square axes depending on picker mode:
    // - hue mode: horizontal = saturation, vertical = luminosity
    // - saturation mode: horizontal = hue, vertical = luminosity
    // - luminosity mode: horizontal = hue, vertical = saturation
    // - red mode: horizontal = green, vertical = blue (1D = red)
    // - green mode: horizontal = red, vertical = blue (1D = green)
    // - blue mode: horizontal = red, vertical = green (1D = blue)
    if (pickerMode === 'hue') {
        currentColor.s = x;
        currentColor.l = 1 - y;
    } else if (pickerMode === 'saturation') {
        currentColor.h = x;
        currentColor.l = 1 - y;
    } else if (pickerMode === 'luminosity') {
        currentColor.h = x;
        currentColor.s = 1 - y;
    } else if (pickerMode === 'red' || pickerMode === 'green' || pickerMode === 'blue') {
        const sliderVal = colorPickerSlider ? parseInt(colorPickerSlider.value, 10) : NaN;
        const currentRgb = hslToRgb(currentColor.h, currentColor.s, currentColor.l);
        if (pickerMode === 'red') {
            const r = isNaN(sliderVal) ? currentRgb.r : Math.max(0, Math.min(255, sliderVal));
            const g = Math.round(x * 255);
            const b = Math.round((1 - y) * 255);
            currentColor = rgbToHsl(r, g, b);
        } else if (pickerMode === 'green') {
            const g = isNaN(sliderVal) ? currentRgb.g : Math.max(0, Math.min(255, sliderVal));
            const r = Math.round(x * 255);
            const b = Math.round((1 - y) * 255);
            currentColor = rgbToHsl(r, g, b);
        } else if (pickerMode === 'blue') {
            const b = isNaN(sliderVal) ? currentRgb.b : Math.max(0, Math.min(255, sliderVal));
            const r = Math.round(x * 255);
            const g = Math.round((1 - y) * 255);
            currentColor = rgbToHsl(r, g, b);
        }
    }

    // Keep values in valid ranges
    currentColor.h = Math.max(0, Math.min(1, currentColor.h));
    currentColor.s = Math.max(0, Math.min(1, currentColor.s));
    currentColor.l = Math.max(0, Math.min(1, currentColor.l));

    updateSliderMode();
    updateUI();
}

function updateColorFromSlider() {
    const v = parseInt(colorPickerSlider.value, 10);
    if (isNaN(v)) return;

    if (pickerMode === 'hue') {
        currentColor.h = v / 360;
    } else if (pickerMode === 'saturation') {
        currentColor.s = v / 100;
    } else if (pickerMode === 'luminosity') {
        currentColor.l = v / 100;
    } else if (pickerMode === 'red' || pickerMode === 'green' || pickerMode === 'blue') {
        // modify the corresponding RGB channel and convert back to HSL
        const rgb = hslToRgb(currentColor.h, currentColor.s, currentColor.l);
        if (pickerMode === 'red') rgb.r = Math.max(0, Math.min(255, v));
        if (pickerMode === 'green') rgb.g = Math.max(0, Math.min(255, v));
        if (pickerMode === 'blue') rgb.b = Math.max(0, Math.min(255, v));
        currentColor = rgbToHsl(rgb.r, rgb.g, rgb.b);
    }

    // clamp and refresh
    currentColor.h = Math.max(0, Math.min(1, currentColor.h));
    currentColor.s = Math.max(0, Math.min(1, currentColor.s));
    currentColor.l = Math.max(0, Math.min(1, currentColor.l));

    updateUI();
}

function updateColorFromRGB() {
    const r = parseInt(redInput.value, 10);
    const g = parseInt(greenInput.value, 10);
    const b = parseInt(blueInput.value, 10);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        currentColor = rgbToHsl(r, g, b);
        updateUI(false); // Don't update RGB inputs again
    }
}

function updateColorFromHSL() {
    const h = parseInt(hueInput.value, 10);
    const s = parseInt(saturationInput.value, 10);
    const l = parseInt(luminosityInput.value, 10);
    if (!isNaN(h) && !isNaN(s) && !isNaN(l)) {
        currentColor.h = h / 360;
        currentColor.s = s / 100;
        currentColor.l = l / 100;
        updateUI(false, false); // Don't update HSL inputs again
    }
}

function updateColorFromHex() {
    const hex = hexInput.value;
    if (/^#?([0-9A-F]{3}){1,2}$/i.test(hex)) {
        const rgb = hexToRgb(hex);
        if (rgb) {
            currentColor = rgbToHsl(rgb.r, rgb.g, rgb.b);
            updateUI(true, true, false); // Don't update Hex input again
        }
    }
}

/**
 * Updates all UI elements based on the current color state.
 */
function updateUI(updateRGB = true, updateHSL = true, updateHex = true) {
    // Update square background based on mode
    const satPct = `${Math.round(currentColor.s * 100)}%`;
    const lumPct = `${Math.round(currentColor.l * 100)}%`;
    const hueDeg = Math.round(currentColor.h * 360);
    const rgbNow = hslToRgb(currentColor.h, currentColor.s, currentColor.l);

    if (pickerMode === 'saturation') {
        // horizontal = hue, vertical = luminosity
        colorPickerSquare.style.backgroundColor = '';
        colorPickerSquare.style.backgroundBlendMode = '';
        colorPickerSquare.style.backgroundImage =
            `linear-gradient(to top, black, transparent, white), ` +
            `linear-gradient(to right, hsl(0, ${satPct}, 50%), hsl(60, ${satPct}, 50%), hsl(120, ${satPct}, 50%), hsl(180, ${satPct}, 50%), hsl(240, ${satPct}, 50%), hsl(300, ${satPct}, 50%), hsl(360, ${satPct}, 50%))`;
    } else if (pickerMode === 'luminosity') {
        // horizontal = hue, vertical = saturation
        colorPickerSquare.style.backgroundColor = '';
        colorPickerSquare.style.backgroundBlendMode = '';
        colorPickerSquare.style.backgroundImage =
            `linear-gradient(to top, hsl(0, 0%, ${lumPct}), transparent), ` +
            `linear-gradient(to right, hsl(0, 100%, ${lumPct}), hsl(60, 100%, ${lumPct}), hsl(120, 100%, ${lumPct}), hsl(180, 100%, ${lumPct}), hsl(240, 100%, ${lumPct}), hsl(300, 100%, ${lumPct}), hsl(360, 100%, ${lumPct}))`;
    } else if (pickerMode === 'red') {
        // 2D: horizontal = green, vertical = blue. 1D slider = red.
        colorPickerSquare.style.backgroundColor = `rgb(${rgbNow.r}, 0, 0)`;
        colorPickerSquare.style.backgroundImage = `linear-gradient(to right, black, rgb(0,255,0)), linear-gradient(to top, black, rgb(0,0,255))`;
        colorPickerSquare.style.backgroundBlendMode = 'screen';
    } else if (pickerMode === 'green') {
        // 2D: horizontal = red, vertical = blue. 1D slider = green.
        colorPickerSquare.style.backgroundColor = `rgb(0, ${rgbNow.g}, 0)`;
        colorPickerSquare.style.backgroundImage = `linear-gradient(to right, black, rgb(255,0,0)), linear-gradient(to top, black, rgb(0,0,255))`;
        colorPickerSquare.style.backgroundBlendMode = 'screen';
    } else if (pickerMode === 'blue') {
        // 2D: horizontal = red, vertical = green. 1D slider = blue.
        colorPickerSquare.style.backgroundColor = `rgb(0, 0, ${rgbNow.b})`;
        colorPickerSquare.style.backgroundImage = `linear-gradient(to right, black, rgb(255,0,0)), linear-gradient(to top, black, rgb(0,255,0))`;
        colorPickerSquare.style.backgroundBlendMode = 'screen';
    } else {
        // hue mode: horizontal = saturation, vertical = luminosity
        colorPickerSquare.style.backgroundColor = '';
        colorPickerSquare.style.backgroundBlendMode = '';
        colorPickerSquare.style.backgroundImage =
            `linear-gradient(to top, black, transparent, white), ` +
            `linear-gradient(to right, hsl(${hueDeg}, 0%, 50%), hsl(${hueDeg}, 100%, 50%))`;
    }

    // Update pointer position depending on mode
    let pointerX = 0;
    let pointerY = 0;
    if (pickerMode === 'hue') {
        pointerX = currentColor.s * 100;
        pointerY = (1 - currentColor.l) * 100;
    } else if (pickerMode === 'saturation') {
        pointerX = currentColor.h * 100;
        pointerY = (1 - currentColor.l) * 100;
    } else if (pickerMode === 'luminosity') {
        pointerX = currentColor.h * 100;
        pointerY = (1 - currentColor.s) * 100;
    } else if (pickerMode === 'red') {
        pointerX = (rgbNow.g / 255) * 100;
        pointerY = (1 - (rgbNow.b / 255)) * 100;
    } else if (pickerMode === 'green') {
        pointerX = (rgbNow.r / 255) * 100;
        pointerY = (1 - (rgbNow.b / 255)) * 100;
    } else if (pickerMode === 'blue') {
        pointerX = (rgbNow.r / 255) * 100;
        pointerY = (1 - (rgbNow.g / 255)) * 100;
    }

    colorPickerPointer.style.left = `${pointerX}%`;
    colorPickerPointer.style.top = `${pointerY}%`;
    
    const pointerRgb = hslToRgb(currentColor.h, currentColor.s, currentColor.l);
    colorPickerPointer.style.backgroundColor = `rgb(${pointerRgb.r}, ${pointerRgb.g}, ${pointerRgb.b})`;

    // Ensure slider reflects current mode/value
    updateSliderMode();

    // Update input fields
    const rgb = hslToRgb(currentColor.h, currentColor.s, currentColor.l);
    if (updateRGB && redInput && greenInput && blueInput) {
        redInput.value = rgb.r;
        greenInput.value = rgb.g;
        blueInput.value = rgb.b;
    }
    if (updateHSL && hueInput && saturationInput && luminosityInput) {
        hueInput.value = Math.round(currentColor.h * 360);
        saturationInput.value = Math.round(currentColor.s * 100);
        luminosityInput.value = Math.round(currentColor.l * 100);
    }
    if (updateHex && hexInput) {
        hexInput.value = rgbToHex(rgb.r, rgb.g, rgb.b);
    }
}

// --- Color Conversion Utilities ---

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function hexToRgb(hex) {
    let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}