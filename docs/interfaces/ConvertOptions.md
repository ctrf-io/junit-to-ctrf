[**Junit CTRF Test Reporter v0.1.0**](../README.md)

***

[Junit CTRF Test Reporter](../README.md) / ConvertOptions

# Interface: ConvertOptions

Defined in: [convert.ts:18](https://github.com/ctrf-io/junit-to-ctrf/blob/main/src/convert.ts#L18)

Options for the conversion

## Extends

- `IdentityOptions`

## Properties

### envProps?

> `optional` **envProps?**: `string`[]

Defined in: [convert.ts:21](https://github.com/ctrf-io/junit-to-ctrf/blob/main/src/convert.ts#L21)

***

### log?

> `optional` **log?**: `boolean`

Defined in: [convert.ts:23](https://github.com/ctrf-io/junit-to-ctrf/blob/main/src/convert.ts#L23)

***

### outputPath?

> `optional` **outputPath?**: `string`

Defined in: [convert.ts:19](https://github.com/ctrf-io/junit-to-ctrf/blob/main/src/convert.ts#L19)

***

### runId?

> `optional` **runId?**: `string`

Defined in: identity.ts:13

Supply the same value to every document in a coordinated logical run.

#### Inherited from

`IdentityOptions.runId`

***

### shardId?

> `optional` **shardId?**: `string`

Defined in: identity.ts:15

Label the partition producing this document, not a test thread.

#### Inherited from

`IdentityOptions.shardId`

***

### testIdResolver?

> `optional` **testIdResolver?**: (`test`) => `string`

Defined in: identity.ts:17

Override the deterministic default when the framework cannot distinguish cases.

#### Parameters

##### test

`TestIdentity`

#### Returns

`string`

#### Inherited from

`IdentityOptions.testIdResolver`

***

### toolName?

> `optional` **toolName?**: `string`

Defined in: [convert.ts:20](https://github.com/ctrf-io/junit-to-ctrf/blob/main/src/convert.ts#L20)

***

### useSuiteName?

> `optional` **useSuiteName?**: `boolean`

Defined in: [convert.ts:22](https://github.com/ctrf-io/junit-to-ctrf/blob/main/src/convert.ts#L22)
