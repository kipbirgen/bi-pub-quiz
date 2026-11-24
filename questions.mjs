// The first choice is correct. The server shuffles choices before play.
const glossary = (rows, prompt) => rows.trim().split('\n').map(line => {
  const [term, correct, a, b, c] = line.split('|');
  return { id: term, prompt: prompt(term), choices: [correct, a, b, c], explanation: term + ' means: ' + correct + '.' };
});
const basics = glossary(`
KPI|Key performance indicator|Known processing interval|Key partition index|Kernel performance interface
gross margin percentage|Gross profit divided by revenue|Revenue divided by gross profit|Gross profit divided by orders|Cost of sales divided by revenue
median|Middle value in sorted data|Sum of all values|Most frequent value|Largest value
mode|Most frequent value|Lowest value|Arithmetic mean|Middle value
range|Maximum minus minimum|Mean minus median|Sum divided by count|Maximum plus minimum
distinct count|Number of unique values|Sum of numeric IDs|Number of all rows|Number of duplicate rows
conversion rate|Conversions divided by eligible opportunities|Conversions multiplied by visitors|Total revenue divided by sales|Number of paid invoices
average order value|Order revenue divided by order count|Orders divided by revenue|Customers divided by orders|Revenue divided by sessions
signup cohort|Users grouped by when they signed up|Users grouped alphabetically|Users grouped by favourite dashboard|Only users who cancelled
year-over-year comparison|Comparison with the same period last year|Comparison with the previous week|Comparison with annual budget|Comparison with next month
budget variance|Difference between actual and budgeted results|Difference between mean and median|Difference between two prior years|Difference between two chart axes
data freshness|How up to date the data is|How wide a table is|How many measures exist|How often the layout changes
seasonality|A pattern recurring at regular calendar intervals|An isolated outage|A source system restart|Missing identifiers
point-in-time metric|A measurement of state at a specific instant|A count of all historical transactions|A distribution across products|A rolling sum without dates
null|Absence of a value|A recorded zero|An empty chart axis|A negative number
dimension|A field used to group or categorize results|A calculated numeric total|An axis label style|A query timeout
measure|A quantity calculated or summarized for analysis|A user role|A chart title|A table name
cumulative total|A running sum through each successive period|The difference from the prior period|The sample median|The highest single day
data grain|What a single row represents|The number of chart colours|The database password rules|The refresh frequency
rolling average|An average across a moving window|An average across unrelated columns|A fixed annual target|A count of null records
`, term => 'Which definition best matches “' + term + '”?');

const modelling = glossary(`
primary key|Uniquely identifies a row|Measures loading speed|Groups bars in a chart|Stores all duplicate rows
foreign key|References a key in another or related table|Encrypts a column|Stores the table name|Specifies a currency
left join|Keeps every left-side row even without a match|Keeps matched rows only|Keeps every right-side row only|Keeps unmatched right-side rows only
inner join|Returns matching row pairs|Keeps every left-side row|Keeps every right-side row|Keeps only non-matching rows
fact table|Records events or measurements at a defined grain|Stores dashboard styles|Contains only column aliases|Lists user permissions
data lineage|Tracks data origins and transformations|Calculates a growth rate|Sorts a list alphabetically|Records browser screen size
ETL|Extract, transform, load|Estimate, test, launch|Extract, tabulate, label|Export, transform, log
deduplication|Removing redundant records|Converting pence to pounds|Filling missing data|Dividing users into cohorts
referential integrity|References point to existing keys|Charts have readable titles|Dates display in local time|All measures have two decimals
incremental load|Processes new or changed data since a checkpoint|Processes all historic data each run|Imports only field names|Removes all rows before reading them
data completeness|How much required data is present|How fast a report loads|How precise a timestamp is|How many fonts a dashboard uses
surrogate key|A generated identifier without required business meaning|An existing customer email|A sorted chart axis|A currency symbol
periodic snapshot|Records state at regular intervals|Stores only transaction IDs|Stores only error logs|Deletes each data point after use
cardinality|How many values or matches a field or relationship can have|How long the chart title is|How deeply a dashboard is nested|How often a database user logs in
`, term => 'What is the role or meaning of “' + term + '”?');

const qlik = [
  ['What does green with a check mark mean in Qlik Sense’s default selection colours?', 'Selected', 'Excluded', 'Possible but unselected', 'Missing'],
  ['What does white mean in Qlik Sense’s default selection colours?', 'Possible under current selections', 'Deleted', 'Excluded', 'Invalid'],
  ['What does dark grey without a check mark mean in the default selection colours?', 'Excluded by current selections', 'Selected', 'Possible', 'A favourite'],
  ['What can Qlik create when two tables share two or more field names?', 'A synthetic key', 'A bookmark for every row', 'An empty visualization', 'A new dashboard for each field'],
  ['Which Qlik feature defines the record scope of an aggregation?', 'Set analysis', 'Sheet title', 'App thumbnail', 'Chart legend'],
  ['Which Qlik object lets users make selections from field values?', 'Filter pane', 'Image', 'Chart title', 'Text label'],
  ['Where would you edit Qlik scripted data transformations?', 'Data load editor', 'Selections toolbar', 'Chart legend', 'Sheet title'],
  ['Which Qlik expression counts distinct CustomerID values?', 'Count(DISTINCT CustomerID)', 'Sum(CustomerID)', 'Avg(CustomerID)', 'Max(CustomerID)'],
  ['Which Qlik expression sums the amount in the Sales field?', 'Sum(Sales)', 'Count(Sales)', 'Only(Sales)', 'Min(Sales)'],
  ['Which Qlik view shows the app’s data tables and associations?', 'Data model viewer', 'App thumbnail editor', 'Selections toolbar', 'Sheet subtitle']
].map(([prompt, ...choices], i) => ({
  id: 'qlik-' + i, prompt, choices, explanation: [
    'The default theme marks selected values in green.',
    'White values are compatible with the current selections.',
    'Excluded values do not match the current selections.',
    'A synthetic key can represent combinations of shared fields.',
    'Set analysis can define a different record set for a chart aggregation.',
    'A filter pane exposes selectable field values.',
    'The data load editor is where the load script is managed.',
    'DISTINCT makes Count count each distinct non-null value once.',
    'Sum adds the numeric values in the applicable record set.',
    'The data model viewer shows tables and their relationships.'
  ][i]
}));

const chartCases = [
  ['Support tickets',12,18,15,9], ['Weekly orders',34,27,41,31], ['New accounts',8,11,16,14],
  ['Returned parcels',28,23,17,33], ['Trial starts',25,33,29,41], ['Open cases',70,64,81,75],
  ['Site sessions',110,145,120,105], ['Paid invoices',56,48,62,59], ['Active accounts',40,33,51,43],
  ['Product demos',19,24,14,29], ['Published reports',68,55,61,77], ['Device activations',32,43,36,23],
  ['Completed surveys',23,17,28,31], ['Unique visitors',89,96,83,91], ['Warehouse picks',150,125,175,140],
  ['New contracts',11,29,18,23], ['Issues resolved',36,44,51,39], ['Feature requests',14,27,35,18],
  ['Cancelled bookings',24,18,25,31], ['Qualified leads',32,35,48,42], ['Daily bookings',20,30,55,40],
  ['Repeat orders',66,73,86,80], ['Units returned',42,33,61,28], ['Data refreshes',44,50,38,57],
  ['Shipped orders',42,47,44,61], ['Processed claims',36,54,45,70], ['Booked meetings',88,94,71,82],
  ['Fulfilled orders',160,120,185,170], ['Overdue invoices',14,19,23,29], ['Active trials',38,40,44,46]
];
const charts = chartCases.map(([title, ...values], i) => {
  const labels = i % 2 ? ['Mon', 'Tue', 'Wed', 'Thu'] : ['North', 'East', 'South', 'West'];
  const chart = { title, labels, values };
  const id = 'chart-' + i;
  const max = Math.max(...values), min = Math.min(...values);
  const special = [
    ['Which baseline keeps the bar lengths proportional to their counts?', ['0','50','60','70'], 'A zero baseline makes bar lengths proportional to their values.'],
    ['Which chart type would show these daily values as a connected trend?', ['Line chart','Pie chart','Treemap','Histogram'], 'A line chart connects observations in time order.'],
    ['When can the regional counts be added to get a unique total?', ['Every invoice belongs to exactly one region','All counts are the same','The highest bar comes first','The bars share a colour'], 'Non-overlapping regional groups ensure each invoice is counted once.'],
    ['What else would you need to compare trial rates by day?', ['The eligible population each day','The sum of the four bars','The order of the days','The longest bar'], 'Rates divide each count by its eligible population.']
  ][i - 26];
  if (special) {
    const [prompt, choices, explanation] = special;
    return { id, chart, prompt, choices, explanation };
  }
  if (i % 4 < 2) {
    const best = i % 4 === 0 ? max : min;
    const label = labels[values.indexOf(best)];
    return { id, chart, prompt: 'Which bar has the ' + (best === max ? 'highest' : 'lowest') + ' count?',
      choices: [label, ...labels.filter(x => x !== label)], explanation: label + ' has a count of ' + best + '.' };
  }
  const total = i % 4 === 2;
  const n = total ? values.reduce((a, b) => a + b, 0) : max - min;
  return { id, chart, prompt: total ? 'What is the total across all four bars?' : 'How many more are in the highest bar than in the lowest?',
    choices: [n, n + 3, n + 6, n + 10].map(String),
    explanation: (total ? values.join(' + ') : max + ' − ' + min) + ' = ' + n + '.' };
});

export const rounds = [
  { name: 'BI Basics', items: basics },
  { name: 'Read the Chart', items: charts },
  { name: 'Data & Qlik', items: [...modelling, ...qlik] }
];
export const estimates = [
  ['A refresh starts with 64,000 rows, and exactly 7.5% are rejected. How many rows pass?', 59200, 'rows'],
  ['A dashboard logs 1,250 events per hour for 7 days. How many events does it log?', 210000, 'events'],
  ['A warehouse has 48 tables of 12,500 rows each. How many rows is that in total?', 600000, 'rows'],
  ['A sample has 38,400 rows and 6.25% are duplicates. How many rows are duplicates?', 2400, 'rows'],
  ['A report has 84,000 sessions and a 3.5% conversion rate. How many sessions converted?', 2940, 'sessions'],
  ['A shop averages 375 orders a day for 28 days. How many orders does it receive?', 10500, 'orders'],
  ['An import processes 420 rows a second for 16 minutes. How many rows does it process?', 403200, 'rows'],
  ['A filtered chart displays exactly 18% of 275,000 customers. How many customers is that?', 49500, 'customers'],
  ['A team removes 12.5% from a table of 72,800 rows. How many rows remain?', 63700, 'rows'],
  ['Each of 640 shops submits 24 hourly records per day. How many arrive over five days?', 76800, 'records']
].map(([prompt, target, unit]) => ({ prompt, target, unit }));
