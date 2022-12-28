
let code ='';
let curPtr = 0;
let curLine = 0;
let value = 0;
let isRun = 0;
let isWait = '';
let inputKey = 0;
let inputDone = 0;
let loops = [];
let stack = [];
let workMem = new Uint8Array(65536);

function findLine(n) {
    for(let p = 0; p >= 0; p = skpLine(p)) {
        if(isNum(p)) {
            p = lineNum(p);
            if(curLine >= n) {
                if(code[p] != ' ')
                    p = skpLine(p);
                return p;
            }
        }
    }
}
function dumpLine(p) {
    return;
    let s = '';
    let p0 = p;
    while(code[p] >= ' ') {
        s += code[p++];
    }
    console.log(">", p0, s);
}
function isNum(p) {
    if(code[p] >= '0' && code[p] <= '9')
        return 1;
    return 0;
}
function skpSpc(p) {
    while(code[p] <= ' ') {
            ++p;
    }
    return p;
}
function skpName(p) {
    while((code[p] >= 'A' && code[p] <= 'Z') || (code[p] >= '0' && code[p] <= '9')) {
        ++p;
    }
    return p;
}
function skpLine(p) {
    for(;;) {
        if(code[p] == '\n') {
            return p + 1;
        }
        ++p;
    }
}
function synCheck(p, ch) {
    if(code[p] == ch)
        return p + 1;
    return error('SYNTAX');
}
function nextStr(p) {
    const p0 = p;
    while(code[p] >= ' ' && code[p] != '"')
        ++p;
    value = code.substring(p0, p);
    return synCheck(p, '"');
}
function checkStr(p, s) {
    if(code.substring(p, p+5).indexOf(s) == 0) {
        return 1;
    }
    return 0;
}
function readAd(ad) {
    const v = workMem[ad] + (workMem[ad + 1] << 8);
    if(v & 0x8000)
        return v - 0x10000;
    return v;
}
function toStr(v, c, r) {
    switch(r) {
    case 10:
        return v.toString().padStart(c,' ');
    case 16:
        const s = v.toString(16).toUpperCase();
        return s.padStart(c, '0');
    }
}
function lineNum(p) {
    curLine = 0;
    while(isNum(p)) {
        curLine = curLine * 10 + (code[p]|0);
        ++p;
    }
    return p;
}
function sleep(msec) {
    return new Promise(function(resolve) {
       setTimeout(function() {resolve()}, msec);
  
    })
 }
 async function eval0(p) {
    value = 0;
    if(code[p] == '(') {
        p = await evalEx(p + 1);
        p = synCheck(p, ')');
        return p;
    }
    if(code[p] == '"') {
        p = nextStr(p + 1);
        value = value.charCodeAt(0);
        return p;
    }
    if(code[p] == '$' && (code[p + 1] <= ' '
             || code[p + 1] == undefined)) {            // INPUT char
        inputDone = 0;
        isWait = '$';
        self.postMessage(['wait', '$']);
        for(;;) {
            await sleep(100);
            if(inputDone) {
                value=inputKey;
                isWait = '';
                return p + 1;
            }
        }
    }
    if(code[p] == '?') {                                // INPUT Number
        inputDone = 0;
        isWait = '?';
        self.postMessage(['wait', '?']);
        for(;;) {
            await sleep(100);
            if(inputDone) {
                value=inputKey;
                isWait = '';
                return p + 1;
            }
        }
    }
    if(code[p] >= 'A' && code[p] <= 'Z') {              // Variables
        const cc = code.charCodeAt(p);
        p = skpName(p);
        let ad = (cc - 0x41) * 2;
        switch(code[p]) {
        case ':':
            p = await evalEx(p + 1);
            p = synCheck(p, ')');
            ad = workMem[ad] + (workMem[ad + 1] << 8) + value;
            value = workMem[ad];
            return p;
        case '(':
            p = await evalEx(p + 1);
            p = synCheck(p, ')');
            ad = workMem[ad] + (workMem[ad + 1] << 8) + value * 2;
            value = readAd(ad);
            return p;
        default:
            value = readAd(ad);
            return p;
        }
    }
    if(code[p] == '$') {                                // Hex Number
        ++p;
        for(;;) {
            const cc = code.charCodeAt(p);
            if(cc >= 0x30 && cc <= 0x39)
                value = value * 16 + cc - 0x30;
            else if(cc >= 0x41 && cc <= 0x46)
                value = value * 16 + cc - 0x41 + 10;
            else
                break;
            ++p;
        }
        return p;
    }
    if(code[p] >= '0' && code[p] <= '9') {              // Decimal Number
        for(;;) {
            const cc = code.charCodeAt(p);
            if(cc >= 0x30 && cc <= 0x39)
                value = value * 10 + cc - 0x30;
            else
                break;
            ++p;
        }
        return p;
    }
    error('SYNTAX');
}
async function eval1(p) {
    switch(code[p]) {
    case '-':                               // Minus
        p = await eval0(p + 1);
        value = -value;
        return p;
    case '+':                               // Absolute
        p = await eval0(p + 1);
        if(value < 0)
            value = -value;
        return p;
    case '%':                               // Mod
        p = await eval0(p + 1);
        value = value2;
        return p;
    case "'":                               // Random
        p = await eval0(p + 1);
        value = ((Math.random() * value)|0) + 1;
        return p;
    case '#':                               // Not
        p = await eval0(p + 1);
        if(value)
            value = 0;
        else
            value = 1;
        return p;
    default:
        return await eval0(p);
    }
}
async function evalEx(p) {
    p = await eval1(p);
    let v = value;
    for(;;) {
        if(checkStr(p, '<=')) {
            p = await eval1(p + 2);
            value = (v <= value) ? 1 : 0;
        }
        else if(checkStr(p, '>=')) {
            p = await eval1(p + 2);
            value = (v >= value) ? 1 : 0;
        }
        else if(checkStr(p, '<>')) {
            p = await eval1(p + 2);
            value = (v != value) ? 1 : 0;
        }
        else if(checkStr(p,  '+')) {
            p = await eval1(p + 1);
            value = v + value;
        }
        else if(checkStr(p, '-')) {
            p = await eval1(p + 1);
            value = v - value;
        }
        else if(checkStr(p, '*')) {
            p = await eval1(p + 1);
            value = v * value;
        }
        else if(checkStr(p, '/')) {
            p = await eval1(p + 1);
            if(value == 0) {
                error('0 DIVIDE');
            }
            value2 = v % value;
            value = (v - value2)/ value;
        }
        else if(checkStr(p, '=')) {
            p = await eval1(p + 1);
            value = (v == value) ? 1 : 0;
        }
        else if(checkStr(p, '<')) {
            p = await eval1(p + 1);
            value = (v < value) ? 1 : 0;
        }
        else if(checkStr(p, '>')) {
            p = await eval1(p + 1);
            value = (v > value) ? 1 : 0;
        }
        else if(checkStr(p, '&')) {
            p = await eval1(p + 1);
            value = v & value;
        }
        else if(checkStr(p, '.')) {
            p = await eval1(p + 1);
            value = v | value;
        }
        else if(checkStr(p, '!')) {
            p = await eval1(p + 1);
            value = v ^ value;
        }
        else
            return p;
        v = value;
    }
}

async function statement(p) {
    dumpLine(p);
    if(code[p] == undefined) {
        isRun = 0;
        return -1;
    }
    p = skpSpc(p);
    if(isNum(p)) {                              // LineNum
        p = lineNum(p);
        if(code[p] == ' ' || code[p] == '\t')
            return skpSpc(p);
        return skpLine(p);
    }
    if(code[p] >= 'A' && code[p] <= 'Z') {      // LEFT value
        const cc = code.charCodeAt(p);
        let adr = (cc - 0x41) * 2;
        let bytes = 2;
        p = skpName(p);
        switch(code[p]) {
        case ':':                               // LET 1Byte Array
            p = await evalEx(p + 1);
            p = synCheck(p, ')');
            p = synCheck(p, '=');
            adr = workMem[adr] + (workMem[adr + 1] << 8) + value;
            bytes = 1;
            p = await evalEx(p);
            workMem[adr] = value & 0xff;
            break;
        case '(':                               // LET 2Bytes Array
            p = await evalEx(p + 1);
            p = synCheck(p, ')');
            p = synCheck(p, '=');
            adr = workMem[adr] + (workMem[adr + 1] << 8) + value * 2;
            p = await evalEx(p);
            workMem[adr] = value & 0xff;
            workMem[adr + 1] = (value >> 8); 
            break;
        case '=':                               // LET Variables
            p = await evalEx(p + 1);
            workMem[adr] = value & 0xff;
            workMem[adr + 1] = (value >> 8);
            break;
        }
        if(code[p] == ',') {                    // start FOR loop
            p = await evalEx(p + 1);
            loops.push({type:'F', a:adr, b:bytes, e:value, ptr:p, line:curLine});
        }
        return p;
    }
    if(checkStr(p, '#=')) {                     // GOTO
        await evalEx(p + 2);
        if(value < 0) {
            isRun = 0;
            return -1;
        }
        p = findLine(value);
        return p;
    }
    if(checkStr(p, '!=')) {                     // GOSUB
        p = await evalEx(p + 2);
        if(value < 0)
            return -1;
        stack.push([p, curLine]);
        p = findLine(value);
        return p;
    }
    if(checkStr(p, ']')) {                      // RETURN
        if(stack.length == 0) {
            error('STACK');
            return -1;
        }
        const p = stack.pop();
        curLine = p[1];
        return p[0];
    }
    if(checkStr(p, '@=')) {                     // FOR..NEXT / DO..UNTIL loop
        if(loops.length > 0) {
            p = await evalEx(p + 2);
            const l = loops[loops.length - 1];
            switch(l.type) {
            case 'F':                           // NEXT
                workMem[l.a] = value;
                if(l.b == 2)
                    workMem[l.a + 1] = value >> 8;
                if(value > l.e){
                    loops.pop();
                    return p;
                }
                curLine = l.line;
                return skpSpc(l.ptr);
            case 'D':                           // UNTIL
                if(value) {
                    loops.pop();
                    return p;
                }
                curLine = l.line;
                return skpSpc(l.ptr);
            }
        }
        return -1;
    }
    if(checkStr(p, ';=')) {                     // IF
        p = await evalEx(p + 2);
        if(value == 0) {
            p = skpLine(p);
        }
        return p;
    }
    if(checkStr(p, '@')) {                      // start DO loop
        p = skpSpc(p + 1);
        loops.push({type:'D', ptr:p, line:curLine})
        return p;
    }
    if(checkStr(p, '?$=')) {                    // PRINT HEX(2 colums)
        p = await evalEx(p + 3);
        const s = toStr(value & 0xff, 2, 16);
        output(s);
        return p;
    }
    if(checkStr(p, '??=')) {                    // PRINT HEX(4 colums)
        p = await evalEx(p + 3);
        const s = toStr(value, 4, 16);
        output(s);
        return p;
    }
    if(checkStr(p, '?=')) {                     // PRINT Decimal
        p = await evalEx(p + 2);
        const s = value.toString();
        output(s);
        return p;
    }
    if(checkStr(p, '?(')) {                     // PRINT Decimal(n colums)
        p = await evalEx(p + 2);
        const c = value;
        if(checkStr(p, ')=')) {
            p = await evalEx(p + 2);
            const s = toStr(value, c, 10);
            output(s);
            return p;
        }
        error('SYNTAX');
        return -1;
    }
    if(checkStr(p, '$=')) {                     // PRINT char
        p = await evalEx(p + 2);
        output(String.fromCharCode(value));
        return p;
    }
    if(checkStr(p, '.=')) {                     // PRINT space
        p = await evalEx(p + 2);
        output(' '.repeat(value & 0xff));
        return p;
    }
    if(checkStr(p, '/')) {                      // PRINT LF
        output('\n');
        return p + 1;
    }
    if(checkStr(p, '"')) {                      // PRINT string
        p = nextStr(p + 1);
        output(value);
        return p;
    }
    if(checkStr(p, "'=")) {                     // Set Random Seed (Not implemented)
        p = await evalEx(p + 2);
        return p;
    }
    if(code[p] > ' ')
        error('SYNTAX');
    return -1;
}
function output(s) {
    self.postMessage(['output', s]);
}
function error(p) {
    console.log("ERROR");
    self.postMessage(['error', p, curLine]);
}
self.addEventListener('message', (e) => {
    switch(e.data[0]) {
    case 'code':
        code = e.data[1];
        curPtr = inputDone = 0;
        isWait = '';
        isRun = 0;
        break;
    case 'run':
        curPtr = inputDone = 0;
        isWait = '';
        isRun = 1;
        break;
    case 'stop':
        isRun = 0;
        break;
    case 'key':
        inputKey = e.data[1];
        inputDone = 1;
        break;
    }
});
setInterval(async ()=>{
    if(isRun && isWait == '' && curPtr >= 0) {
        curPtr = await statement(curPtr);
    }
},5);