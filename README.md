# game-interpreter

1970年代の終わり頃に流行った GAME 言語のインタプリタを Javascript で実装してみたものです。

GAME言語の文法については [http://www.mztn.org/game86/](http://www.mztn.org/game86/)あたりを参照してください。 

SharedArrayBuffer を有効にするため coi-serviceworker.js を使用しています。   
[https://github.com/gzuidhof/coi-serviceworke](https://github.com/gzuidhof/coi-serviceworker)

'Trace' をオンにすると Javascript コンソールに実行中の行を表示します。

---
![](20221227_game.png)

## Live Demo
[https://g200kg.github.io/game-interpreter/gameinterpreter.html](https://g200kg.github.io/game-interpreter/gameinterpreter.html)

