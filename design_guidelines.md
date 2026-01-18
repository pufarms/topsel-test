# Order Management System - Design Guidelines

## Design Approach
**Selected System**: Material Design adapted for dashboard applications
**Rationale**: Utility-focused order management system requiring clarity, data density, and efficient workflows. Material Design provides established patterns for tables, forms, and data visualization while maintaining professional aesthetics.

## Core Design Principles
1. **Efficiency First**: Minimize clicks and cognitive load for frequent tasks
2. **Data Clarity**: Clear visual hierarchy in tables and lists
3. **Consistent Patterns**: Predictable layouts across all pages
4. **Mobile Responsive**: Functional on tablets and mobile devices

## Typography System
- **Primary Font**: Inter or Noto Sans KR (Korean support essential)
- **Headings**: 
  - H1: text-3xl font-bold (Page titles)
  - H2: text-xl font-semibold (Section headers)
  - H3: text-lg font-medium (Card titles, form sections)
- **Body**: text-base (Tables, forms, content)
- **Labels**: text-sm font-medium (Form labels, table headers)
- **Helper Text**: text-sm (Descriptions, hints)

## Spacing System
**Tailwind Units**: Consistently use 4, 6, 8, 12, 16 for most spacing
- Component padding: p-6 to p-8
- Section spacing: mb-8 to mb-12
- Form field gaps: space-y-4
- Card/container gaps: gap-6

## Layout Structure

### Authentication Pages (/login, /register)
- Centered card layout (max-w-md mx-auto)
- Single column form with generous spacing
- Logo/branding at top
- Clear call-to-action buttons
- Link to alternate action (login ↔ register)

### Main Page (/)
- Simple landing with navigation
- Quick access cards to login/register
- Brief system description
- No hero image - keep functional

### Seller Dashboard (/dashboard)
**Two-Section Layout**:
1. **Order Entry Form** (top or left)
   - Card container with form fields
   - Grid layout for compact fields (2 columns on desktop)
   - Clear submit button
2. **My Orders List** (bottom or right)
   - Table view with columns: Order ID, Product, Quantity, Price, Date, Status
   - Search/filter bar above table
   - Responsive: stack to single column on mobile

### Admin Panel (/admin)
**Tab Navigation**:
- Tabs for "Users" and "Orders"
- CSV Export button prominently placed (top right)

**Users Tab**:
- Data table: Email, Name, Role, Registration Date
- Search functionality
- Pagination if needed

**Orders Tab**:
- Comprehensive table: Order ID, Seller, Product, Quantity, Price, Recipient, Contact, Address, Date
- Filter controls (date range, seller)
- Sort capabilities on key columns

## Component Library

### Navigation
- Horizontal navbar: Logo left, user info/logout right
- Show current user name and role
- Active page indication with subtle underline or background

### Forms
- Stacked label above input layout
- Input fields: rounded-lg border with focus:ring states
- Required field indicators (asterisk)
- Error messages below fields (text-sm)
- Submit buttons: full-width on mobile, auto-width on desktop

### Tables
- Striped rows for readability (even rows slightly different)
- Sticky headers for long lists
- Hover states on rows
- Responsive: Convert to card layout on mobile (each row becomes a card)
- Empty states with helpful messages

### Cards
- Rounded-xl with subtle shadow
- Padding: p-6 to p-8
- Header with title and optional actions
- Content area with consistent spacing

### Buttons
- Primary: Solid fill for main actions (Submit, Create Order, Export CSV)
- Secondary: Outlined for alternate actions
- Size: px-6 py-3 for standard, px-4 py-2 for compact
- Clear hover/focus states built-in

### Data Display
- Status badges: Small rounded-full px-3 py-1 elements
- Metrics cards: Large numbers with labels
- Clean dividers between sections

## Page-Specific Guidelines

### Dashboard Optimization
- Show most recent orders first
- Quick stats at top (total orders, total value)
- Form validation feedback immediate and clear

### Admin Efficiency
- Bulk actions where applicable
- Quick filters as chips/tags
- Export maintains current filters

## Responsive Behavior
- **Desktop (lg:)**: Side-by-side layouts, multi-column forms
- **Tablet (md:)**: Stacked sections, 2-column forms
- **Mobile**: Single column everything, tables convert to cards, navigation collapses to hamburger

## Accessibility
- Form labels properly associated
- Keyboard navigation throughout
- Clear focus indicators
- ARIA labels for icon-only buttons
- Sufficient color contrast for all text

## No Animations
Static, stable interface prioritizing speed and clarity over motion effects.