import { WASI } from "@bjorn3/browser_wasi_shim";

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
let radiostrict = document.getElementById('evalorderapp');
let radiolazy = document.getElementById('evalordernorm');
let radiohnf = document.getElementById('evalhnf');
let radionf = document.getElementById('evalnf');
let checkstep = document.getElementById('evalstep');

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

function getEvalOrder() {
  return document.querySelector('input[name="evalorder"]:checked').value;
}

function getEvalTo() {
  return document.querySelector('input[name="evalto"]:checked').value;
}

const hl_color = "#00AAAA"
function setHTMLof(elmt, lam_md_str) {
  let code = (lam_md_str.includes("\n")) ? ("<code style=\"display:block\">") : "<code>";
  elmt.innerHTML = code + lam_md_str
    .replaceAll("\x1b[4m", "<span style=\"color: " + hl_color + "\">")
    .replaceAll("\x1b[0m", "</span>")
    .replaceAll("\n", "<br>") + "</code>";
}

buttonreduce.onclick = async () => {
  if (boxreduce.value.length == 0) {
    setHTMLof(outputreduce, "");
  } else {
    const step = checkstep.checked;
    const step_str = step ? 'true' : 'false';
    const in_str = step_str + '§' + getEvalOrder() + '§' + getEvalTo() + '§' + boxdefs.value + '§' + boxreduce.value;
    const [in_ptr, in_len] = encodeString(in_str);
    const out_ptr = inst.exports.myreduce(in_ptr, in_len);
    const out_str = decodeString(out_ptr);
    setHTMLof(outputreduce, out_str);
    freeString(in_ptr);
    freeString(out_ptr);
    performGC();
  }
};

buttonbohm.onclick = async () => {
  const in_str = boxdefs.value + '§' + boxbohma.value + '§' + boxbohmb.value;
  const [in_ptr, in_len] = encodeString(in_str);
  const out_ptr = inst.exports.bohmout(in_ptr, in_len);
  const out_str = decodeString(out_ptr);
  setHTMLof(outputbohm, out_str);
  freeString(in_ptr);
  freeString(out_ptr);
  performGC();
};
