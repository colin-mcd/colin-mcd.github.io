import { WASI } from "./node_modules/@bjorn3/browser_wasi_shim/dist/index.js";
//import { Buffer } from 'buffer';

//const canvas = document.getElementById('GameCanvas');
//const context = canvas.getContext('2d');

// TODO: figure out how to make 'memory' variable const
// Right now this variable is initialised when initialising WASM module
let memory = null;
// Ideally it would be initialised something like this:
// const memory = new WebAssembly.Memory({
//     initial: 256,
//     maximum: 4096,
//     shared: true,
//   });
// but then I get errors about using shared buffers with TextDecoder and TextEncoder
// Some answer is here:
// https://stackoverflow.com/a/76916494


// Functions that will be called from Haskell
// Essentially a small subset of wrapped Canvas functions and Canvas routines
const externalFunctions = {
//     arc : (x, y, radius, startAngle, endAngle, counterclockwise) => {
//         context.arc(x, y, radius, startAngle, endAngle, counterclockwise);
//     },
//     ellipse : (x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) => {
//         context.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise);
//     },
//     fill : () => {
//         context.fill();
//     },
//     beginPath : () => {
//         context.beginPath();
//     },
//     closePath : () => {
//         context.closePath();
//     },
//     stroke : () => {
//         context.stroke();
//     },
//     moveTo : (x, y) => {
//         context.moveTo(x, y);
//     },
//     lineTo : (x, y) => {
//         context.lineTo(x, y);
//     },
//     clearCanvas : (colR, colG, colB) => {
//         context.fillStyle=`rgb(${colR},${colG},${colB})`;
//         context.fillRect(0, 0, canvas.width, canvas.height);
//     },
//     fillStyle : (colR, colG, colB) => {
//         context.fillStyle=`rgb(${colR},${colG},${colB})`;
//     },
//     fillRect : (x, y, width, height) => {
//         context.fillRect(x, y, width, height);
//     },
//     getCanvasWidth : () => {
//         return canvas.width;
//     },
//     getCanvasHeight : () => {
//         return canvas.height;
//     },
//     setFont : (textPtr, textLen) => {
//         const decoder = new TextDecoder();
//         const textArr = new Uint8Array(memory.buffer, textPtr, textLen);
//         const text = decoder.decode(textArr);
//         context.font = text;
//     },
//     fillText : (textPtr, textLen, x, y, maxWidth) => {
//         const decoder = new TextDecoder();
//         const textArr = new Uint8Array(memory.buffer, textPtr, textLen);
//         const text = decoder.decode(textArr);
//         context.fillText(text, x, y, maxWidth);
//     }
}


let buttonreduce = document.getElementById('buttonreduce');
let buttonbohm = document.getElementById('buttonbohm');
let boxdefs = document.getElementById('boxdefs');
let boxreduce = document.getElementById('boxreduce');
let boxbohma = document.getElementById('boxbohma');
let boxbohmb = document.getElementById('boxbohmb');
let outputreduce = document.getElementById('outputreduce');
let outputbohm = document.getElementById('outputbohm');

const wasi = new WASI([], [], []);
let __exports = {};
const wasiImportObj = { 
    wasi_snapshot_preview1: wasi.wasiImport,
    ghc_wasm_jsffi: (await import('./Web.js')).default(__exports),
    env: externalFunctions
};
const wasm = await WebAssembly.compileStreaming(fetch('./Web.wasm'));
let inst = null;

async function refreshInstance() {
    inst = await WebAssembly.instantiate(wasm, wasiImportObj);
    wasi.initialize(inst);
    inst.exports.hs_init(0, 0);
    Object.assign(__exports, inst.exports);
    memory = inst.exports.memory;
}


await refreshInstance();
console.log(inst.exports);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeString(inputData) {
    // TODO: is there a more efficient way to compute the byte length?
    const inputLen = encoder.encode(inputData).length;
    const inputPtr = inst.exports.malloc(inputLen);
    const inputArr = new Uint8Array(memory.buffer, inputPtr, inputLen);
    encoder.encodeInto(inputData, inputArr);
    return [inputPtr, inputLen];
}

function decodeString(outputPtr) {
    const outputLen = inst.exports.getCharPtrSize(outputPtr);
    const outputArr = new Uint8Array(memory.buffer, outputPtr, outputLen);
    return decoder.decode(outputArr);
}

function freeString(ptr) {
    inst.exports.free(ptr);
}

async function performGC() {
    inst.exports.hs_perform_gc();
    await refreshInstance();
}

buttonreduce.onclick = async () => {
    const [in_ptr, in_len] = encodeString(boxdefs.value + '§' + boxreduce.value);
    const out_ptr = inst.exports.myreduce(in_ptr, in_len);
    outputreduce.value = decodeString(out_ptr);
    freeString(in_ptr);
    freeString(out_ptr);
    performGC();
};

buttonbohm.onclick = async () => {
    const in_str = boxdefs.value + '§' + boxbohma.value + '§' + boxbohmb.value;
    const [in_ptr, in_len] = encodeString(in_str);
    const out_ptr = inst.exports.bohmout(in_ptr, in_len);
    outputbohm.value = decodeString(out_ptr);
    freeString(in_ptr);
    freeString(out_ptr);
    performGC();
};

//memory = inst.exports.memory;
// const encoder = new TextEncoder();
// const decoder = new TextDecoder();

// // Just an example of sending and receving
// // byte arrays to and from a WASI reactor
// // Followed this example:
// // https://github.com/willmcpherson2/ghc-wasm-experiment/tree/main
// const inputData = "Test String!"
// const inputLen = Buffer.byteLength(inputData);
// const inputPtr = inst.exports.malloc(inputLen);
// const inputArr = new Uint8Array(memory.buffer, inputPtr, inputLen);
// encoder.encodeInto(inputData, inputArr);

// const outputPtr = inst.exports.reverseCharArray(inputPtr, inputLen);
// const outputArr = new Uint8Array(memory.buffer, outputPtr, inputLen);
// const output = decoder.decode(outputArr);
// console.log(`'${inputData}' reversed is '${output}'`)
// inst.exports.free(inputPtr);
// inst.exports.free(outputPtr);

// var previousTimeStamp = null;
// function step(timeStamp) {
//     if (!previousTimeStamp) {
//         previousTimeStamp = timeStamp;
//     }
//     const deltaTime = (timeStamp-previousTimeStamp)/1000;
//     inst.exports.runGameStep(mouseX, mouseY, deltaTime);
//     previousTimeStamp = timeStamp;
//     window.requestAnimationFrame(step);
// }
// window.requestAnimationFrame(step);

