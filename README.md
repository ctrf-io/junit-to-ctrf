# Convert JUnit XML to CTRF JSON

> Convert JUnit reports to CTRF reports

This package is useful if there isn't a CTRF reporter available for your test framework.

<div align="center">
<div style="padding: 1.5rem; border-radius: 8px; margin: 1rem 0; border: 1px solid #30363d;">
<span style="font-size: 23px;">💚</span>
<h3 style="margin: 1rem 0;">CTRF tooling is open source and free to use</h3>
<p style="font-size: 16px;">You can support the project with a follow and a star</p>

<div style="margin-top: 1.5rem;">
<a href="https://github.com/ctrf-io/junit-to-ctrf">
<img src="https://img.shields.io/github/stars/ctrf-io/junit-to-ctrf?style=for-the-badge&color=2ea043" alt="GitHub stars">
</a>
<a href="https://github.com/ctrf-io">
<img src="https://img.shields.io/github/followers/ctrf-io?style=for-the-badge&color=2ea043" alt="GitHub followers">
</a>
</div>
</div>

<p style="font-size: 14px; margin: 1rem 0;">
Maintained by <a href="https://github.com/ma11hewthomas">Matthew Thomas</a><br/>
Contributions are very welcome! <br/>
Explore more <a href="https://www.ctrf.io/integrations">integrations</a>
</p>
</div>

## Usage

```sh
npx junit-to-ctrf path/to/junit.xml
```

or glob pattern:

```sh
npx junit-to-ctrf "test-results/**/*.xml"
```

## Options

`-o`, `--output` <output>: Output directory and filename for the CTRF report. If not provided, defaults to ctrf/ctrf-report.json.

`-t`, `--tool` <toolName>: Tool name to include in the CTRF report.

`-u`, `--use-suite-name` <useSuiteName>: Use suite name in the test name, defaults to true.

`-e`, `--env` <envProperties>: Environment properties to include in the CTRF report. Accepts multiple properties in the format KEY=value.


## Examples

Convert a JUnit XML report to the default CTRF report location (ctrf/ctrf-report.json):

```sh
npx junit-to-ctrf "test-results/**/*.xml"
```

### Specify Output File

Convert a JUnit XML report to a specified output file:

```sh
npx junit-to-ctrf "test-results/**/*.xml" -o ctrf/combined-report.json
```

### Include Tool Name

Convert a JUnit XML report and include a tool name in the CTRF report:

```sh
npx junit-to-ctrf path/to/junit.xml -t ExampleTool
```

### Include Environment Properties

Convert a JUnit XML report and include environment properties in the CTRF report:

```sh
npx junit-to-ctrf path/to/junit.xml -e appName=MyApp buildName=MyBuild
```

See [CTRF schema](https://www.ctrf.io/docs/schema/environment) for possible environment properties

### Exclude Suite Name

```sh
npx junit-to-ctrf path/to/junit.xml -u false
```

### Full Command

Combine all options in a single command:

```sh
npx junit-to-ctrf path/to/junit.xml -o path/to/output/ctrf-report.json -t ExampleTool -e appName=MyApp buildName=MyBuild
```

## What is CTRF?

CTRF is a universal JSON test report schema that addresses the lack of a standardized format for JSON test reports.

**Consistency Across Tools:** Different testing tools and frameworks often produce reports in varied formats. CTRF ensures a uniform structure, making it easier to understand and compare reports, regardless of the testing tool used.

**Language and Framework Agnostic:** It provides a universal reporting schema that works seamlessly with any programming language and testing framework.

**Facilitates Better Analysis:** With a standardized format, programatically analyzing test outcomes across multiple platforms becomes more straightforward.

## Support Us

If you find this project useful, consider giving it a GitHub star ⭐ It means a lot to us.
