Bootstrap a dashboard by creating ./frontend directory and ./backend directory — Python, FastAPI, https://pypi.org/project/lyzr-adk/ — with a frontend Vite React dashboard that is futuristic, sleek, clean, dark arctic themed — #1c1c1c dark gradients, and glowing arctic cyan highlights #7DEBFF — This dashboard will be used by automobile loan underwriters to assist in the decision-making process of whether or not to give someone a loan. The user is the underwriter, so they should provide two sets of information: 1) pastable long text input of "Underwriting Rules & Guidelines", 2) Applicant Data

Here is an example of all the information must be collected before a response is agentically calculated with a YES (green) or NO (red), and explanations after the agentic workflows finishes processing:

Applicant data:

Credit score: 642
Monthly gross income: $5,200
Monthly verified income: $5,200
Income verification: Two recent pay stubs provided and employer verification completed
Employment status: Full-time, employed for 2.5 years
Existing monthly debt obligations: $2,050
Requested loan amount: $28,000
Down payment: $2,000
Vehicle value: $29,500
Vehicle valuation source: Dealer book-out using approved valuation guide
Vehicle: 2021 SUV, 48,000 miles, clean title
Loan term: 72 months
Estimated APR: 11.5%
Estimated monthly payment: $540
Credit history: One 60-day delinquency 10 months ago, no bankruptcy, no repossession, no charge-off
Recent inquiries: 2 auto-loan inquiries in the past 30 days
Add-ons included in loan amount: Taxes and title included; no warranty, GAP, or service contract included

Working underwriting policy for this test:

Credit score 740+: strong credit profile
Credit score 670–739: standard review
Credit score 580–669: elevated-risk review; may qualify with compensating factors
Credit score below 580: high-risk review and likely decline unless strong exception applies
Maximum front-end payment-to-income ratio: 15%
Maximum total debt-to-income ratio after proposed auto loan: 50%
Maximum loan-to-value ratio for used vehicles: 110%
Maximum term for used vehicles under 6 years old and under 75,000 miles: 72 months
Recent 60-day delinquency within 12 months requires manual review unless strong compensating factors exist

To complete this dashboard, you will need to make API calls to Lyzr ADK, with API keys and example inference calls below —
[Pasted text #3 +82 lines]

Or:
[Pasted text #4 +8 lines]
