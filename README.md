# BmxplayJS

Bmxplay, JavaScript version. Written in "modern" OOP with closures (where applicable).

For C version and Buzz-compatible machines see the original bmxplay project.

## Demo

http://bmxplay.sourceforge.net

## Installation

npm:

```
npm install && npm run-script compile
```

## API

- `Load(bytes: string): number`
- `SetCallback(callback: function({pos:integer, size:integer})): void`
- `Play(): boolean`
- `Stop(): boolean`
- `SetPos(pos: integer): void`
- `IsPlaying(): boolean`
- `Render(callback: function(data: Uint16Array), repeats: integer): void`
- `GetOscData(type: number, size: number, smooth: number): Uint8Array`

## License

MIT

