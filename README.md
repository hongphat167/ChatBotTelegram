# Expense Manager Bot

## Overview
This project implements a Telegram bot to manage and track your expenses and income. The bot allows users to log financial transactions and calculate monthly totals for expenses and income directly through a chat interface.

---

## Features

- **Log Expenses**: Add an expense with a specific amount and note (e.g., `15k ăn sáng`).
- **Log Income**: Add income with a specific amount and note (e.g., `+7 triệu tiền lương`).
- **Calculate Total Expenses**: Retrieve the total expenses for the current month by typing `tổng chi`.
- **Calculate Total Income**: Retrieve the total income for the current month by typing `tổng thu`.

---

## Installation

### Prerequisites
- Node.js and npm installed.
- A Telegram bot token (create a bot using [BotFather](https://core.telegram.org/bots#botfather)).
- A Google Apps Script webhook to handle data storage and calculation.

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/expense-manager-bot.git
   cd expense-manager-bot
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file in the root directory and add the following:
   ```env
   BOT_TOKEN=your_telegram_bot_token
   WEBHOOK_URL=https://your-webhook-url-for-logging
   WEBHOOK_URL_v2=https://your-webhook-url-for-totals
   ```
4. Run the bot:
   ```bash
   node index.js
   ```

---

## Usage

### Commands
- **Log an Expense**:
  ```
  15k ăn sáng
  ```
  Logs an expense of 15,000 VND with the note "ăn sáng".

- **Log an Income**:
  ```
  +7 triệu tiền lương
  ```
  Logs an income of 7,000,000 VND with the note "tiền lương".

- **Get Monthly Expenses**:
  ```
  tổng chi
  ```
  Displays the total expenses for the current month.

- **Get Monthly Income**:
  ```
  tổng thu
  ```
  Displays the total income for the current month.

---

## File Structure

```plaintext
.
├── index.js         # Main bot logic
├── .env             # Environment variables
├── package.json     # Node.js dependencies
└── README.md        # Project documentation
```

---

## Webhook Setup

### Google Apps Script Webhook
Use Google Sheets as the data storage backend. Deploy the following script in Google Apps Script:

```javascript
function doGet(e) {
    if (!e.parameter.action) {
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Invalid action provided.'
        })).setMimeType(ContentService.MimeType.JSON);
    }

    const action = e.parameter.action;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');

    if (action === 'getMonthlyTotal' || action === 'getMonthlyIncome') {
        const currentMonth = new Date().getMonth() + 1;
        let total = 0;
        const type = action === 'getMonthlyTotal' ? 'Tiền ra' : 'Tiền vào';

        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            const [_, timestamp, rowType, amount] = data[i];
            const date = new Date(timestamp);
            if ((date.getMonth() + 1) === currentMonth && rowType === type) {
                total += parseFloat(amount);
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            total: total
        })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Action not supported.'
    })).setMimeType(ContentService.MimeType.JSON);
}
```

---

## Notes
- Ensure your webhook URLs are correctly deployed and accessible.
- Validate all inputs to avoid unexpected errors.

---

## License
This project is licensed under the MIT License.

