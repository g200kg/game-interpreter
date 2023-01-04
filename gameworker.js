
let code ='';
let curPtr = 0;
let line = 0;
let value = 0;
let loops = [];
let stack = [];
let workMem = new Uint8Array(65536);

let sab;
let sabStat;
const ISRUN = 0;        // sabStat[ISRUN]
const INPUTWAIT = 1;    // sabStat[INPUTWAIT]
const INPUTVALUE = 2;   // sabStat[INPUTVALUE]
const CURLINE = 3;      // sabStat[CURLINE]
const TRACE = 4;        // sabStat[TRACE]
const OUTQUE = 5;       // sabStat[OUTQUE]

function checkStr(p, s) {
    const l = s.length;
    for(let i=0; i < l; ++i) {
        if(code[p + i] != s[i])
            return 0;
    }
    return 1;
}
function findLine(n) {
    for(p = 0; p >= 0; p = skpSpc(skpLine(p))) {
        if(isNum(p)) {
            const pl = lineNum(p);
            p = pl.p;
            if(pl.l >= n) {
                if(code[p] != 0x20)
                    p = skpSpc(skpLine(p));
                return {p:p, l:n};
            }
        }
    }
    return {p:-1, l:0};
}
function dumpLine(p) {
    if(sabStat[TRACE] == 0)
        return;
    let s = '';
    let p0 = p;
    while(code[p] >= 0x20) {
        ++p;
    }
    if(code[p0] >= 0x30 && code[p0] <= 0x39) {
        const l = code.subarray(p0, p);
        const str = new TextDecoder().decode(l);
        console.log(str);
        return;
    }
}
function isNum(p) {
    if(code[p] >= 0x30 && code[p] <= 0x39)
        return 1;
    return 0;
}
function skpSpc(p) {
    while(code[p] <= 0x20) {
            ++p;
    }
    return p;
}
function skpName(p) {
    while((code[p] >= 0x41 && code[p] <= 0x5a) || (code[p] >= 0x30 && code[p] <= 0x39)) {
        ++p;
    }
    return p;
}
function skpLine(p) {
    for(;;) {
        if(code[p] == 0x0a) {
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
    value ='';
    const p0 = p;
    while(code[p] >= 0x20 && code[p] != 0x22) {
        value += String.fromCharCode(code[p]);
        ++p;
    }
    const view = code.subarray(p0, p);
    value = new TextDecoder().decode(view);
    return synCheck(p, 0x22);
}
function readAd(ad) {
    const v = workMem[ad] + (workMem[ad + 1] << 8);
    return clip16(v);
}
function clip16(x) {
    if(x & 0x8000)
        return x|0xffff0000;
    return x&0xffff;
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
    let l = 0;
    while(isNum(p)) {
        l = l * 10 + (code[p] - 0x30);
        ++p;
    }
    return {p:p, l:l};
}
function sleep(msec) {
    return new Promise(function(resolve) {
       setTimeout(function() {resolve()}, msec);
  
    })
 }
 function eval0(p) {
    value = 0;
    if(code[p] == 0x28) {                                   // "("
        p = evalEx(p + 1);
        p = synCheck(p, 0x29);                              // ")"
        return p;
    }
    if(code[p] == 0x22) {                                   // "\"" String
        p = nextStr(p + 1);
        value = value.charCodeAt(0);
        return p;
    }
    if(code[p] == 0x25 && (code[p + 1] <= 0x20
            || code[p + 1] == undefined)) {
        value = value2;
        return p + 1;
    }
    if(code[p] == 0x24 && (code[p + 1] <= 0x20
            || code[p + 1] == undefined)) {                 // "$" INPUT char
        sabStat[INPUTWAIT] = 1;                             // wait input
        self.postMessage(['input', '$']);
        while(sabStat[INPUTWAIT])
                ;
        value = sabStat[INPUTVALUE];
        return p + 1;
    }
    if(code[p] == 0x3f) {                                   // "?" INPUT Number
        sabStat[INPUTWAIT] = 1;                             // wait input
        self.postMessage(['input', '?']);
        while(sabStat[INPUTWAIT])
            ;
        value=sabStat[INPUTVALUE];
        return p + 1;
    }
    if(code[p] >= 0x41 && code[p] <= 0x5a) {                // "A-Z" Variables
        const cc = code[p];
        p = skpName(p);
        let ad = (cc - 0x41) * 2;
        switch(code[p]) {
        case 0x3a:                                          // ":"
            p = evalEx(p + 1);
            p = synCheck(p, 0x29);                          // ")"
            ad = workMem[ad] + (workMem[ad + 1] << 8) + value;
            value = workMem[ad];
            return p;
        case 0x28:                                          // "("
            p = evalEx(p + 1);
            p = synCheck(p, 0x29);                          // ")"
            ad = workMem[ad] + (workMem[ad + 1] << 8) + value * 2;
            value = readAd(ad);
            return p;
        default:
            value = readAd(ad);
            return p;
        }
    }
    if(code[p] == 0x24) {                                   // Hex Number
        ++p;
        for(;;) {
            const cc = code[p];
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
    if(code[p] >= 0x30 && code[p] <= 0x39) {                // Decimal Number
        for(;;) {
            const cc = code[p];
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
function eval1(p) {
    switch(code[p]) {
    case 0x2d:                                              // "-" Minus
        p = eval1(p + 1);
        value = -value;
        return p;
    case 0x2b:                                              // "+" Absolute
        p = eval1(p + 1);
        if(value < 0)
            value = -value;
        return p;
    case 0x25:                                              // "%" Mod
        if(code[p + 1] > 0x20) {
            p = eval1(p + 1);
            value = value2;
            return p;
        }
        return eval0(p);
    case 0x27:                                              // "'" Random
        p = eval1(p + 1);
        value = ((Math.random() * value)|0);
        return p;
    case 0x23:                                              // "#" Not
        p = eval1(p + 1);
        if(value)
            value = 0;
        else
            value = 1;
        return p;
    default:
        return eval0(p);
    }
}
function evalEx(p) {
    p = eval1(p);
    let v = value = clip16(value);
    for(;;) {
        if(checkStr(p, [0x3c, 0x3d])) {                     // "<="
            p = eval1(p + 2);
            value = (v <= value) ? 1 : 0;
        }
        else if(checkStr(p, [0x3e, 0x3d])) {                // ">="
            p = eval1(p + 2);
            value = (v >= value) ? 1 : 0;
        }
        else if(checkStr(p, [0x3c, 0x3e])) {                // "<>"
            p = eval1(p + 2);
            value = (v != value) ? 1 : 0;
        }
        else if(code[p] == 0x2b) {                          // "+"
            p = eval1(p + 1);
            value = v + value;
        }
        else if(code[p] == 0x2d) {                          // "-"
            p = eval1(p + 1);
            value = v - value;
        }
        else if(code[p] == 0x2a) {                          // "*"
            p = eval1(p + 1);
            value = v * value;
        }
        else if(code[p] == 0x2f) {                          // "/"
            p = eval1(p + 1);
            if(value == 0) {
                error('0 DIVIDE');
            }
            value2 = v % value;
            value = (v - value2)/ value;
        }
        else if(code[p] == 0x3d) {                          // "="
            p = eval1(p + 1);
            value = (v == value) ? 1 : 0;
        }
        else if(code[p] == 0x3c) {                          // "<"
            p = eval1(p + 1);
            value = (v < value) ? 1 : 0;
        }
        else if(code[p] == 0x3e) {                          // ">"
            p = eval1(p + 1);
            value = (v > value) ? 1 : 0;
        }
        else if(code[p] == 0x26) {                          // "&"
            p = eval1(p + 1);
            value = v & value;
        }
        else if(code[p] == 0x2e || code[p] == 0x7c) {       // "." "|"
            p = eval1(p + 1);
            value = v | value;
        }
        else if(code[p] == 0x21) {                          // "!"
            p = eval1(p + 1);
            value = v ^ value;
        }
        else
            return p;
        v = value = clip16(value);
    }
}

function statement(p) {
    if(code[p] == undefined) {
        return -1;
    }
    p = skpSpc(p);
    dumpLine(p);
    const ch = code[p];
    if(isNum(p)) {                                          // LineNum
        const pl = lineNum(p);
        p = pl.p;
        sabStat[CURLINE] = pl.l;
        if(code[p] == 0x20 || code[p] == 0x09)
            return skpSpc(p);
        return skpLine(p);
    }
    if(ch >= 0x41 && ch <= 0x5a) {                          // "A-Z" LEFT value
        const cc = code[p];
        let adr = (cc - 0x41) * 2;
        let bytes = 2;
        p = skpName(p);
        switch(code[p]) {
        case 0x3a:                                          // ":" LET 1Byte Array
            p = evalEx(p + 1);
            p = synCheck(p, 0x29);                          // ")"
            p = synCheck(p, 0x3d);                          // "="
            adr = workMem[adr] + (workMem[adr + 1] << 8) + value;
            bytes = 1;
            p = evalEx(p);
            workMem[adr] = value & 0xff;
            break;
        case 0x28:                                          // "(" LET 2Bytes Array
            p = evalEx(p + 1);
            p = synCheck(p, 0x29);                          // ")"
            p = synCheck(p, 0x3d);                          // "="
            adr = workMem[adr] + (workMem[adr + 1] << 8) + value * 2;
            p = evalEx(p);
            workMem[adr] = value & 0xff;
            workMem[adr + 1] = (value >> 8); 
            break;
        case 0x3d:                                          // "=" LET Variables
            p = evalEx(p + 1);
            workMem[adr] = value & 0xff;
            workMem[adr + 1] = (value >> 8);
            break;
        }
        if(code[p] == 0x2c) {                               // "," start FOR loop
            p = evalEx(p + 1);
            loops.push({type:'F', a:adr, b:bytes, e:value, ptr:p, line:sabStat[CURLINE]});
        }
        return p;
    }
    if(checkStr(p, [0x40, 0x3d])) {                         // "@=" FOR..NEXT / DO..UNTIL loop
        if(loops.length > 0) {
            p = evalEx(p + 2);
            const l = loops[loops.length - 1];
            switch(l.type) {
            case 'F':                                       // NEXT
                workMem[l.a] = value;
                if(l.b == 2)
                    workMem[l.a + 1] = value >> 8;
                if(value > l.e){
                    loops.pop();
                    return p;
                }
                sabStat[CURLINE] = l.line;
                return skpSpc(l.ptr);
            case 'D':                                       // UNTIL
                if(value) {
                    loops.pop();
                    return p;
                }
                sabStat[CURLINE] = l.line;
                return skpSpc(l.ptr);
            }
        }
        return -1;
    }
    switch(ch) {
    case 0x40:                                              // "@" start DO loop
        p = skpSpc(p + 1);
        loops.push({type:'D', ptr:p, line:sabStat[CURLINE]})
        return p;
    case 0x5d:                                              // "]" RETURN
        if(stack.length == 0) {
            error('STACK');
            return -1;
        }
        const pp = stack.pop();
        sabStat[CURLINE] = pp[1];
        return pp[0];
    case 0x2f:                                              // "/" PRINT LF
        output('\n');
        return p + 1;
    case 0x22:                                              // "\"" PRINT string
        p = nextStr(p + 1);
        output(value);
        return p;
    }
    if(checkStr(p, [0x23, 0x3d])) {                         // "#=" GOTO
        evalEx(p + 2);
        if(value < 0) {
            isRun = 0;
            return -1;
        }
        const pl = findLine(value);
        p = pl.p;
        sabStat[CURLINE] = pl.l;
        return p;
    }
    if(checkStr(p, [0x21, 0x3d])) {                         // "!=" GOSUB
        p = evalEx(p + 2);
        if(value < 0)
            return -1;
        stack.push([p, sabStat[CURLINE]]);
        const pl = findLine(value);
        p = pl.p;
        sabStat[CURLINE] = pl.l;
        return p;
    }
    if(checkStr(p, [0x3b, 0x3d])) {                         // ";=" IF
        p = evalEx(p + 2);
        if(value == 0) {
            p = skpLine(p);
        }
        return p;
    }
    if(checkStr(p, [0x3f, 0x24, 0x3d])) {                   // "?$=" PRINT HEX(2 colums)
        p = evalEx(p + 3);
        const s = toStr(value & 0xff, 2, 16);
        output(s);
        return p;
    }
    if(checkStr(p, [0x3f, 0x3f, 0x3d])) {                   // "??=" PRINT HEX(4 colums)
        p = evalEx(p + 3);
        const s = toStr(value, 4, 16);
        output(s);
        return p;
    }
    if(checkStr(p, [0x3f, 0x3d])) {                         // "?=" PRINT Decimal
        p = evalEx(p + 2);
        const s = value.toString();
        output(s);
        return p;
    }
    if(checkStr(p, [0x3f, 0x28])) {                         // "?(" PRINT Decimal(n colums)
        p = evalEx(p + 2);
        const c = value;
        if(checkStr(p, [0x29, 0x3d])) {                     // ")="
            p = evalEx(p + 2);
            const s = toStr(value, c, 10);
            output(s);
            return p;
        }
        error('SYNTAX');
        return -1;
    }
    if(checkStr(p, [0x24, 0x3d])) {                         // "$=" PRINT char
        p = evalEx(p + 2);
        output(String.fromCharCode(value));
        return p;
    }
    if(checkStr(p, [0x2e, 0x3d])) {                         // ".=" PRINT space
        p = evalEx(p + 2);
        output(' '.repeat(value & 0xff));
        return p;
    }
    if(checkStr(p, [0x27, 0x3d])) {                         // "'=" Set Random Seed (Not implemented)
        p = evalEx(p + 2);
        return p;
    }
    if(code[p] > 0x20)
        error('SYNTAX');
    return -1;
}
function output(s) {
    while(sabStat[OUTQUE] > 100)
        ;
    Atomics.add(sabStat, OUTQUE, 1);
    self.postMessage(['output', s]);
}
function error(p) {
    console.log("ERROR");
    self.postMessage(['error', p, sabStat[CURLINE]]);
    sabStat[ISRUN] = 0;
}
function statements() {
    while(sabStat[ISRUN]) {
        curPtr = statement(curPtr);
        if(curPtr < 0)
            sabStat[ISRUN] = 0;
    }
}
self.addEventListener('message', (e) => {
//    console.log(e)
    switch(e.data[0]) {
    case 'init':
        sab = e.data[1];
        sabStat = new Int16Array(sab);
        break;
    case 'code':
        code = new TextEncoder().encode(e.data[1]);
        curPtr = inputDone = 0;
        isWait = '';
        sabStat[ISRUN] = 0;
        break;
    case 'run':
        curPtr = inputDone = 0;
        isWait = '';
        sabStat[ISRUN] = 1;
        statements();
        break;
    case 'key':
        inputKey = e.data[1];
        inputDone = 1;
        break;
    }
});
