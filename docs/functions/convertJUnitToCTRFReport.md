[**Junit CTRF Test Reporter v0.1.0**](../README.md)

***

[Junit CTRF Test Reporter](../README.md) / convertJUnitToCTRFReport

# Function: convertJUnitToCTRFReport()

> **convertJUnitToCTRFReport**(`pattern`, `options?`): `Promise`\<`CTRFReport` \| `null`\>

Defined in: [convert.ts:31](https://github.com/ctrf-io/junit-to-ctrf/blob/main/src/convert.ts#L31)

Convert JUnit XML report(s) to CTRF

## Parameters

### pattern

`string`

Path to JUnit XML file or glob pattern

### options?

[`ConvertOptions`](../interfaces/ConvertOptions.md) = `{}`

Optional options for the conversion

## Returns

`Promise`\<`CTRFReport` \| `null`\>

Promise that resolves when the conversion is complete
