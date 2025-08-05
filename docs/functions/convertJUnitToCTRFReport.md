[**Junit CTRF Test Reporter v0.0.10-next.2**](../README.md)

***

[Junit CTRF Test Reporter](../README.md) / convertJUnitToCTRFReport

# Function: convertJUnitToCTRFReport()

> **convertJUnitToCTRFReport**(`pattern`, `options`): `Promise`\<`null` \| `Report`\>

Defined in: [convert.ts:24](https://github.com/ctrf-io/junit-to-ctrf/blob/main/src/convert.ts#L24)

Convert JUnit XML report(s) to CTRF

## Parameters

### pattern

`string`

Path to JUnit XML file or glob pattern

### options

[`ConvertOptions`](../interfaces/ConvertOptions.md) = `{}`

Optional options for the conversion

## Returns

`Promise`\<`null` \| `Report`\>

Promise that resolves when the conversion is complete
