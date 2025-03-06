import { convertJUnitToCTRFReport } from './convert';

/**
 * This file demonstrates how to use the programmatic methods to convert JUnit XML to CTRF
 */

// Example 1: Convert JUnit XML to CTRF and save to file
async function convertAndSaveToFile() {
    try {
        // Parameters:
        // 1. junitPath: Path to the JUnit XML file
        // 2. outputPath: (Optional) Output path for the CTRF report (default: ctrf/ctrf-report.json)
        // 3. toolName: (Optional) Name of the tool that generated the JUnit report
        // 4. envProps: (Optional) Environment properties as key=value strings
        // 5. useSuiteName: (Optional) Whether to include suite name in test names (default: true)

        await convertJUnitToCTRFReport(
            'test-junit.xml',
            {
                outputPath: 'ctrf/output-report.json',
                toolName: 'junit-test-runner',
                envProps: ['env=production', 'browser=chrome'],
                useSuiteName: true
            }
        );

        console.log('Conversion completed and saved to file successfully.');
    } catch (error) {
        console.error('Error converting JUnit to CTRF:', error);
    }
}

// Run the examples
async function main() {
    //   console.log('Running Example 1: Convert and save to file');
    //   await convertAndSaveToFile();

    const report = await convertJUnitToCTRFReport(
        './*.xml',
        {
            outputPath: 'ctrf/output-report.json',
            toolName: 'junit-test-runner',
            envProps: ['env=production', 'browser=chrome'],
            useSuiteName: true
        }
    );

    if (report) {
        console.log(`\nTest Results: ${report.results.summary.passed} passed, ${report.results.summary.failed} failed`);
    } else {
        console.log('No report generated');
    }
}

// Execute the main function
main().catch(console.error);
