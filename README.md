pretend you are company xyz deciding whether to approve people for car loans

write a doc that describes how you would judge someone's worthiness of a loan based on their credit score

I’ll frame this as a reusable policy-style document, with guardrails so it doesn’t imply credit score alone is the whole decision or permit unfair lending practices.

Thought for 6s

Here’s a draft document you can adapt. I wrote it as a responsible lending policy rather than a “credit score only” rule, because creditors generally need to avoid unfair or discriminatory practices and provide specific reasons when taking adverse action. The Equal Credit Opportunity Act prohibits discrimination in credit decisions based on protected traits, and CFPB guidance emphasizes that lenders must be able to give specific reasons for credit denials.

Company XYZ Auto Loan Credit Score Evaluation Policy
Purpose

Company XYZ uses credit scores as one factor in evaluating whether an applicant is likely to repay an auto loan as agreed. The goal of this policy is to support consistent, fair, and responsible credit decisions while avoiding discrimination and ensuring applicants receive clear explanations when credit is denied or approved on less favorable terms.

Scope

This policy applies to consumer auto loan applications reviewed by Company XYZ. It covers how credit score information may be used in loan approvals, pricing, additional review, and decline decisions.

Core Principle

A credit score is an indicator of credit risk, not a complete measure of a person’s worth, character, or overall financial potential. Company XYZ will use credit scores only to assess the likelihood of repayment and will not use protected characteristics or unrelated personal traits in lending decisions.

Credit Score Source

Company XYZ may consider a credit score obtained from a recognized credit reporting or scoring provider. Most base FICO Scores range from 300 to 850, and higher scores generally indicate lower credit risk to lenders.

The credit score used must be documented in the applicant’s file, including the source, score version if available, date obtained, and any key score-related factors provided by the credit reporting source.

Preliminary Credit Score Bands

Company XYZ may use the following preliminary score bands as a starting point for review:

Credit Score Range Preliminary Risk Category Typical Review Approach
740 and above Strong credit profile Eligible for standard approval review and more favorable pricing consideration
670–739 Acceptable credit profile Eligible for standard approval review
580–669 Elevated credit risk Requires additional review, possible higher down payment, co-signer, or adjusted loan terms
Below 580 High credit risk Requires enhanced review and may be declined if compensating factors are insufficient

These bands are guidelines, not automatic decisions. Company XYZ may adjust thresholds based on market conditions, portfolio performance, regulatory requirements, and documented underwriting standards.

Factors Considered Alongside Credit Score

Company XYZ should not approve or deny an auto loan based only on the credit score. The following additional credit-related and affordability factors may be reviewed:

Income and ability to repay
Employment or income stability
Debt-to-income ratio
Loan amount requested
Vehicle value and loan-to-value ratio
Down payment amount
Credit history depth
Recent delinquencies, bankruptcies, charge-offs, or repossessions
Existing auto loan history
Presence of a qualified co-borrower or co-signer
Decision Framework
Approval

An applicant may be approved when the credit score, income, debt obligations, requested loan terms, and vehicle value indicate a reasonable ability and willingness to repay.

Conditional Approval

An applicant may receive conditional approval when the credit score indicates elevated risk but other factors support repayment. Conditions may include:

Larger down payment
Shorter loan term
Lower approved loan amount
Proof of income
Qualified co-signer or co-borrower
Selection of a less expensive vehicle
Decline

An application may be declined when the applicant’s credit profile and supporting financial information do not meet Company XYZ’s underwriting standards. Examples may include very low credit score, recent serious delinquency, excessive debt obligations, insufficient income, or inability to verify key application information.

Company XYZ must document the specific reason or reasons for a decline.

Fair Lending Standards

Company XYZ will not consider race, color, religion, national origin, sex, marital status, age, receipt of public assistance, or the applicant’s exercise of rights under consumer credit laws when making credit decisions.

Employees may not use credit score policies as a substitute for fair and individualized review. Similarly situated applicants should be treated consistently.

Adverse Action Notices

When Company XYZ denies credit, offers less favorable terms, or otherwise takes adverse action, the applicant must receive a legally appropriate notice explaining the specific reason or reasons for the decision.

Examples of specific reasons may include:

Credit score below Company XYZ’s minimum underwriting threshold
Insufficient credit history
Serious delinquency or derogatory credit history
Excessive debt obligations compared with income
Insufficient income for requested loan amount
Loan-to-value ratio exceeds program limits

The explanation should be clear enough for the applicant to understand the main factors that affected the decision.

Manual Review

Applications near cutoff points should be eligible for manual review. Manual review may consider compensating factors such as stable income, significant down payment, strong recent payment history, or verified improvement in financial circumstances.

Manual overrides must be documented and approved by an authorized reviewer. Overrides should be monitored to ensure consistency and fair lending compliance.

Monitoring and Compliance

Company XYZ should periodically review credit score policies and lending outcomes to ensure that:

Decisions are consistent with written standards
Applicants are treated fairly
Adverse action reasons are accurate and specific
Credit score thresholds remain appropriate for portfolio risk
Policies do not create unjustified disparate impacts
Summary

Company XYZ uses credit scores to help estimate repayment risk for auto loans. A higher credit score may support approval and better loan terms, while a lower score may require additional review, compensating factors, or denial. However, credit score is only one part of the underwriting process, and all decisions must be fair, documented, and based on legitimate creditworthiness factors.

How would I use a Lyzr Knowledge Base for using AI to help decide who gets a car loan?

I’ll answer this as a practical architecture/workflow, and I’ll check current Lyzr docs so the guidance maps to what their Knowledge Base feature actually supports.

Thought for 6s

You can use a Lyzr Knowledge Base as the “policy and evidence layer” for an AI loan-assist system, not as the final automated judge of who gets a car loan.

A good design is: AI recommends, retrieves rules, explains, and flags issues; a governed underwriting system or trained human makes the final credit decision.

What the Lyzr Knowledge Base should contain

Lyzr’s Knowledge Base is designed to let agents retrieve structured and unstructured information using RAG, with configurable retrieval type, chunking, top-k, and testing in a simulator. It also supports connecting a KB to an agent so the agent can answer using company-specific documents rather than relying only on model memory.

For a car-loan AI assistant, I would load documents like:

Knowledge Base content Purpose
Auto loan underwriting policy Tells the agent what credit score bands, debt-to-income limits, loan-to-value limits, and income verification rules apply
Fair lending / ECOA policy Prevents the agent from considering protected traits or giving unsafe recommendations
Adverse action reason catalog Helps generate specific, compliant denial or counteroffer explanations
Vehicle valuation policy Helps assess loan-to-value risk
Income verification rules Helps decide what documents are needed
Exception / manual review policy Tells the agent when to escalate instead of deciding
Audit checklist Ensures every recommendation is traceable
What the AI should do

The Lyzr agent should not say: “Approve Bridget” or “Reject Bridget” with no explanation.

It should say something like:

Based on the underwriting policy retrieved from the Knowledge Base, this application appears to meet the preliminary criteria for conditional approval, subject to income verification and vehicle valuation. The main risk factors are elevated debt-to-income ratio and limited recent auto-loan history. Escalate for manual review if any income source cannot be verified.

That is much safer because it keeps the AI grounded in documents, explains the basis, and avoids pretending the model itself is the legal decision-maker.

Suggested Lyzr workflow

Create a dedicated Knowledge Base

Name it something like Auto Loan Underwriting KB.

Upload controlled policy documents

Use approved, versioned documents only. Do not upload random training notes unless they are reviewed. The KB should include the current underwriting policy, fair lending rules, adverse-action reason codes, and escalation policy.

Configure retrieval carefully

For underwriting, retrieval accuracy matters more than creativity. Use smaller chunks for dense policy documents, test multiple retrieval settings, and tune top-k so the agent retrieves enough context without mixing unrelated rules. Lyzr’s docs specifically recommend configuring chunking, choosing the right retrieval type, uploading high-quality content in batches, and testing with the simulator.

Build an underwriting-support agent

The agent’s instruction should be strict. Example:

You are an auto-loan underwriting support assistant. Use only retrieved Knowledge Base policy and verified applicant data. Do not use protected characteristics. Do not make a final legal credit decision. Provide a recommendation category, supporting policy citations, missing information, risk factors, and whether manual review is required.

Feed applicant data separately

Applicant data should come from your loan origination system or a structured form, not from the Knowledge Base. The KB stores policy; the application system provides facts like credit score, income, debt, requested amount, down payment, and vehicle value.

Return a structured output

Ask the agent to produce something like:

Recommendation: Preliminary approve / conditional approve / manual review / decline candidate
Policy basis: Retrieved policy sections
Key factors considered: Credit score, DTI, LTV, income verification, recent delinquencies
Missing data: Items needed before decision
Fair lending check: Protected traits not used
Adverse action reasons, if applicable: Specific reason codes
Escalation required: Yes/No

Add a human or rules-engine checkpoint

Do not let the Lyzr agent be the only decision-maker. Use it to support underwriters, generate explanations, check policy consistency, and surface missing documents.

Important compliance guardrails

Credit decisions are regulated. The Equal Credit Opportunity Act prohibits discrimination in credit transactions based on traits such as race, color, religion, national origin, sex, marital status, age, receipt of public assistance, or good-faith exercise of rights under consumer credit laws.

If AI or complex algorithms are used in credit decisions, creditors still need to provide specific principal reasons for adverse action; the CFPB has said there is no special exemption just because AI is involved.

So your Lyzr system should avoid:

using protected characteristics or proxies for protected characteristics;
making unexplained “black box” decisions;
generating vague denial reasons like “poor profile”;
relying on unapproved or stale policy documents;
treating the credit score as the applicant’s “worth.”
Best use case

The best role for Lyzr here is a loan underwriting copilot:

“Given this applicant’s financial data, retrieve the relevant underwriting rules, summarize whether the file appears to meet policy, identify missing documents, generate specific adverse-action reason candidates if needed, and flag anything requiring manual review.”

That gives you speed and consistency without handing the whole lending decision to a generative AI model.
