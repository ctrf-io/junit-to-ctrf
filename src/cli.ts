#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { convertJUnitToCTRFReport } from './convert';

yargs(hideBin(process.argv))
  .usage('Usage: $0 <junit.xml> [options]')
  .command(
    '$0 <pattern>',
    'Convert JUnit XML report(s) to CTRF',
    (yargs) => {
      return yargs
      .positional('pattern', {
        describe: 'Glob pattern to match JUnit XML files (e.g., "test-results/**/*.xml")',
        type: 'string',
        demandOption: true,
      })
        .option('output', {
          alias: 'o',
          type: 'string',
          default: 'ctrf/ctrf-report.json',
          description: 'Output directory and filename for the CTRF report',
        })
        .option('tool', {
          alias: 't',
          type: 'string',
          description: 'Tool name',
        })
        .option('env', {
          alias: 'e',
          type: 'array',
          description: 'Environment properties',
        })
        .option('use-suite-name', {
          alias: 'u',
          type: 'boolean',
          default: true,
          description: 'Use suite name in the test name',
        });
    },
    async (argv) => {
      try {
        const { pattern, output, tool, env, useSuiteName  } = argv;
        await convertJUnitToCTRFReport(pattern as string, { outputPath: output as string, toolName: tool as string, envProps: env as string[], useSuiteName: useSuiteName as boolean, log: true });
        console.log('Conversion completed successfully.');
      } catch (error: any) {
        console.error('Error:', error.message);
      }
    }
  )
  .help()
  .argv;
