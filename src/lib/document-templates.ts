/**
 * Document templates for each starting point.
 * These templates provide structured markdown that gets filled in as the user chats with the AI.
 */

export type DocumentType =
  | "prd"
  | "persona"
  | "market"
  | "brand"
  | "business"
  | "feature"
  | "tech"
  | "gtm"
  | "landing"
  | "custom";

export type AgentType =
  | "idea_refinement"
  | "market_validation"
  | "brand_strategy"
  | "customer_persona"
  | "business_model"
  | "new_features"
  | "tech_stack"
  | "create_prd"
  | "go_to_market"
  | "landing_page"
  | "feedback_analysis"
  | "custom";

export interface DocumentTemplate {
  title: string;
  defaultContent: string;
  documentType: DocumentType;
}

export const DOCUMENT_TEMPLATES: Record<AgentType, DocumentTemplate> = {
  idea_refinement: {
    title: "Product Vision",
    defaultContent: `# Product Vision

## Problem Statement
<!-- What problem are you solving? Who experiences this problem? -->

## Target Audience
<!-- Who is your ideal user? What are their characteristics? -->

## Solution Overview
<!-- How does your product solve this problem? -->

## Value Proposition
<!-- What makes this solution valuable to users? -->

## Key Differentiators
<!-- What makes your approach unique compared to alternatives? -->

## Success Metrics
<!-- How will you measure if this idea is successful? -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "prd",
  },

  market_validation: {
    title: "Market Analysis",
    defaultContent: `# Market Analysis

## Market Size

### TAM (Total Addressable Market)
<!-- Total market demand for your product/service -->

### SAM (Serviceable Addressable Market)
<!-- Portion of TAM you can realistically reach -->

### SOM (Serviceable Obtainable Market)
<!-- Realistic market capture in near term -->

## Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
|            |           |            |               |

## Market Trends
<!-- Key trends affecting this market -->

## Barriers to Entry
<!-- What obstacles exist for new entrants? -->

## Demand Signals
<!-- Evidence that there is demand for this solution -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "market",
  },

  customer_persona: {
    title: "Customer Persona",
    defaultContent: `# Customer Persona

## Primary Persona

### Demographics
- **Name:**
- **Age Range:**
- **Role/Title:**
- **Industry:**

### Background
<!-- Brief description of who they are -->

### Goals & Motivations
<!-- What are they trying to achieve? -->

### Pain Points & Frustrations
<!-- What problems do they face today? -->

### Buying Behavior
<!-- How do they make purchasing decisions? -->

### Objections & Concerns
<!-- What might prevent them from buying? -->

## Secondary Persona(s)
<!-- Additional customer segments -->

## Customer Journey
<!-- How do they discover, evaluate, and use your product? -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "persona",
  },

  brand_strategy: {
    title: "Brand Strategy",
    defaultContent: `# Brand Strategy

## Brand Purpose
<!-- Why does this brand exist beyond making money? -->

## Brand Values
<!-- Core values that guide the brand -->
1.
2.
3.

## Brand Personality
<!-- If your brand were a person, how would they act? -->

## Brand Voice & Tone
<!-- How does the brand communicate? -->

## Positioning Statement
<!-- For [target audience] who [need], [brand name] is a [category] that [key benefit]. Unlike [competitors], we [key differentiator]. -->

## Key Messages
<!-- Core messages to communicate -->

## Tagline Ideas
<!-- Memorable phrases that capture the brand -->

## Visual Identity Direction
<!-- Colors, imagery, style notes -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "brand",
  },

  business_model: {
    title: "Business Model",
    defaultContent: `# Business Model

## Value Proposition
<!-- What value do you create for customers? -->

## Revenue Streams
<!-- How will you make money? -->

### Pricing Strategy
<!-- How will you price your offering? -->

## Cost Structure
<!-- What are your major costs? -->

### Unit Economics
- **Customer Acquisition Cost (CAC):**
- **Lifetime Value (LTV):**
- **LTV:CAC Ratio:**

## Key Resources
<!-- What assets are essential to your business? -->

## Key Activities
<!-- What activities are critical to deliver value? -->

## Key Partnerships
<!-- What partners/suppliers do you need? -->

## Channels
<!-- How do you reach and deliver to customers? -->

## Scalability Plan
<!-- How will the business scale? -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "business",
  },

  new_features: {
    title: "Feature Roadmap",
    defaultContent: `# Feature Roadmap

## Current State
<!-- What exists today? -->

## User Needs
<!-- What problems need solving? -->

## Feature Ideas

### High Priority
| Feature | User Need | Impact | Effort | Status |
|---------|-----------|--------|--------|--------|
|         |           |        |        |        |

### Medium Priority
| Feature | User Need | Impact | Effort | Status |
|---------|-----------|--------|--------|--------|
|         |           |        |        |        |

### Future Considerations
| Feature | User Need | Impact | Effort | Status |
|---------|-----------|--------|--------|--------|
|         |           |        |        |        |

## Dependencies
<!-- What needs to happen before certain features? -->

## Success Metrics
<!-- How will you measure feature success? -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "feature",
  },

  tech_stack: {
    title: "Technical Architecture",
    defaultContent: `# Technical Architecture

## Overview
<!-- High-level architecture description -->

## Technical Requirements
<!-- Key technical requirements and constraints -->

## Stack Decisions

### Frontend
<!-- Framework, libraries, hosting -->

### Backend
<!-- Language, framework, database, hosting -->

### Infrastructure
<!-- Cloud provider, CI/CD, monitoring -->

### Third-Party Services
<!-- APIs, SaaS tools, integrations -->

## Build vs Buy Analysis
| Component | Build | Buy | Decision | Rationale |
|-----------|-------|-----|----------|-----------|
|           |       |     |          |           |

## Scalability Considerations
<!-- How will the system scale? -->

## Security Considerations
<!-- Key security requirements -->

## Team Capabilities
<!-- Current team skills and gaps -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "tech",
  },

  create_prd: {
    title: "Product Requirements Document",
    defaultContent: `# Product Requirements Document

## Overview

### Product Name
<!-- Name of the product or feature -->

### Goal
<!-- What is this product trying to achieve? -->

### Success Metrics
<!-- How will success be measured? -->

## User Stories

### As a [user type], I want to [action] so that [benefit]
<!-- Add user stories here -->

## Functional Requirements

### Must Have (P0)
- [ ]

### Should Have (P1)
- [ ]

### Nice to Have (P2)
- [ ]

## Non-Functional Requirements
<!-- Performance, security, accessibility, etc. -->

## Scope

### In Scope
<!-- What's included -->

### Out of Scope
<!-- What's explicitly excluded -->

## Dependencies
<!-- External dependencies and blockers -->

## Milestones
| Milestone | Description | Target Date |
|-----------|-------------|-------------|
|           |             |             |

## Acceptance Criteria
<!-- How will we know when it's done? -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "prd",
  },

  go_to_market: {
    title: "Go-to-Market Strategy",
    defaultContent: `# Go-to-Market Strategy

## Launch Goals
<!-- What are you trying to achieve with this launch? -->

## Success Metrics
<!-- How will you measure success? -->

## Target Audience
<!-- Who are you trying to reach? -->

## Positioning & Messaging
<!-- Key messages for launch -->

## Channel Strategy

### Organic Channels
<!-- SEO, content, social, community -->

### Paid Channels
<!-- Ads, sponsorships, partnerships -->

### Direct Channels
<!-- Sales, outreach, events -->

## Launch Timeline
| Phase | Activities | Timeline |
|-------|------------|----------|
| Pre-launch | | |
| Launch | | |
| Post-launch | | |

## Budget & Resources
<!-- Available budget and team resources -->

## Risks & Mitigation
<!-- Potential issues and how to address them -->

## Measurement Plan
<!-- How will you track and iterate? -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "gtm",
  },

  landing_page: {
    title: "Landing Page Copy",
    defaultContent: `# Landing Page Copy

## Hero Section

### Headline
<!-- Attention-grabbing headline -->

### Subheadline
<!-- Supporting statement -->

### Primary CTA
<!-- Main call-to-action button text -->

## Value Proposition
<!-- Clear statement of what you offer and why it matters -->

## Key Benefits
<!-- 3-5 main benefits (not features) -->

1. **Benefit:**
   Description:

2. **Benefit:**
   Description:

3. **Benefit:**
   Description:

## How It Works
<!-- Simple steps to get started -->

1.
2.
3.

## Social Proof
<!-- Testimonials, logos, stats -->

## Features Section
<!-- Key features with descriptions -->

## Pricing Section
<!-- Pricing tiers or CTA -->

## FAQ
<!-- Common questions and answers -->

**Q:**
**A:**

## Final CTA
<!-- Closing call-to-action -->

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "landing",
  },

  feedback_analysis: {
    title: "Feedback Analysis",
    defaultContent: `# Feedback Analysis

## Overview
<!-- Summary of feedback analyzed -->

## Key Themes

### Theme 1:
<!-- Description and supporting feedback -->

### Theme 2:
<!-- Description and supporting feedback -->

### Theme 3:
<!-- Description and supporting feedback -->

## Feature Requests
| Request | Frequency | Impact | Effort | Priority |
|---------|-----------|--------|--------|----------|
|         |           |        |        |          |

## Bug Reports
| Issue | Frequency | Severity | Status |
|-------|-----------|----------|--------|
|       |           |          |        |

## User Sentiment
<!-- Overall sentiment analysis -->

## Recommendations

### Quick Wins
<!-- Low effort, high impact improvements -->

### Strategic Investments
<!-- Higher effort improvements worth pursuing -->

### Defer or Decline
<!-- Feedback to deprioritize and why -->

## Action Items
- [ ]
- [ ]
- [ ]

---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "feature",
  },

  custom: {
    title: "Custom Document",
    defaultContent: `# Custom Document

<!-- Use this document to capture any strategic context for your project. -->

## Overview


## Details


## Next Steps


---
*This document is being refined through conversation with Skribe.*
`,
    documentType: "custom",
  },
};

/**
 * Get the document template for a starting point type.
 */
export function getDocumentTemplate(agentType: AgentType): DocumentTemplate {
  return DOCUMENT_TEMPLATES[agentType] || DOCUMENT_TEMPLATES.custom;
}

/**
 * Map agent types to document types.
 */
export const AGENT_TYPE_TO_DOC_TYPE: Record<AgentType, DocumentType> = {
  idea_refinement: "prd",
  market_validation: "market",
  customer_persona: "persona",
  brand_strategy: "brand",
  business_model: "business",
  new_features: "feature",
  tech_stack: "tech",
  create_prd: "prd",
  go_to_market: "gtm",
  landing_page: "landing",
  feedback_analysis: "feature",
  custom: "custom",
};

/**
 * Get the inverse mapping: document types to agent types.
 * This is useful for determining which starting points have been completed.
 */
export function getDocTypeToAgentTypes(): Record<DocumentType, AgentType[]> {
  const result: Record<DocumentType, AgentType[]> = {
    prd: [],
    persona: [],
    market: [],
    brand: [],
    business: [],
    feature: [],
    tech: [],
    gtm: [],
    landing: [],
    custom: [],
  };

  for (const [agentType, docType] of Object.entries(AGENT_TYPE_TO_DOC_TYPE)) {
    result[docType].push(agentType as AgentType);
  }

  return result;
}
