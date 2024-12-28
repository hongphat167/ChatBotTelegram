import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import 'dotenv/config';
import express from 'express';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const parseAmount = (amount) => {
    console.log('Parsing amount:', amount);
    if (amount.toLowerCase().endsWith('k')) {
        return parseFloat(amount.replace('k', '').replace(/,/g, '')) * 1000;
    } else if (amount.toLowerCase().includes('triệu')) {
        return parseFloat(amount.replace('triệu', '').replace(/,/g, '').trim()) * 1000000;
    }
    return parseFloat(amount.replace(/[^\d.]/g, ''));
};

const sendErrorMessage = (chatId, error) => {
    console.error('Error:', error);
    bot.sendMessage(chatId, '⚠️ *Oops! Đã có lỗi xảy ra.* Vui lòng thử lại sau nhé! 😢', { parse_mode: 'Markdown' });
};

const sendInlineKeyboard = (chatId) => {
    console.log('Sending inline keyboard to chatId:', chatId);
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📉 Tổng chi', callback_data: 'totalExpense' },
                    { text: '📈 Tổng thu', callback_data: 'totalIncome' }
                ],
                [
                    { text: '💰 Tổng còn lại', callback_data: 'totalRemaining' }
                ],
                [
                    { text: '🗑️ Xóa dữ liệu', callback_data: 'deleteAllData' }
                ]
            ]
        }
    };

    bot.sendMessage(
        chatId,
        '🎯 *Bạn muốn làm gì tiếp theo?* Hãy chọn một trong các mục bên dưới nhé! 👇',
        { parse_mode: 'Markdown', ...options }
    );
};

const callApi = async (url) => {
    try {
        console.log('Calling API with URL:', url.toString());
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }
        const jsonResponse = await res.json();
        console.log('API Response:', jsonResponse);
        return jsonResponse;
    } catch (err) {
        console.error('API Call Error:', err.message);
        throw new Error('API call failed');
    }
};

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    console.log('Received message:', msg.text);
    if (msg.text === '/start') {
        const userName = msg.from.first_name || 'bạn';
        bot.sendMessage(
            chatId,
            `🎉 *Xin chào, ${userName}!*\n\nChào mừng bạn đến với bot quản lý tài chính cá nhân. 🏦\n\nBạn có thể sử dụng các lệnh sau:\n- 📌 Ghi chi tiêu: \`15k ăn sáng\`\n- 📌 Ghi thu nhập: \`+7triệu tiền lương\`\n- 📉 Xem tổng chi: \`tổng chi\`\n- 📈 Xem tổng thu: \`tổng thu\`\n- 💰 Xem số tiền còn lại: \`tổng còn lại\`\n\nHãy bắt đầu quản lý tài chính của bạn ngay hôm nay nhé! 🚀`,
            { parse_mode: 'Markdown' }
        );
    }
});

const handleTransaction = async (chatId, type, amount, note, timestamp) => {
    try {
        console.log('Handling transaction:', { chatId, type, amount, note, timestamp });
        const url = new URL(process.env.WEBHOOK_URL);
        url.searchParams.append('amount', amount);
        url.searchParams.append('type', type);
        url.searchParams.append('note', note);
        url.searchParams.append('timestamp', timestamp);

        const data = await callApi(url);
        console.log('Transaction Response:', data);
        if (data.status === 'success') {
            bot.sendMessage(
                chatId,
                `✅ *Ghi nhận thành công!*\n\n📝 *Chi tiết:*\n- 💵 *Số tiền*: ${amount.toLocaleString('vi-VN')} VND\n- 🗂️ *Loại*: ${type}\n- ✍️ *Ghi chú*: ${note}\n- 🕒 *Thời gian*: ${timestamp}`,
                { parse_mode: 'Markdown' }
            );
            sendInlineKeyboard(chatId);
        } else {
            bot.sendMessage(chatId, `❌ Không thể ghi nhận giao dịch. Phản hồi từ server: *${data.message || 'Unknown error'}*`, { parse_mode: 'Markdown' });
        }
    } catch (err) {
        sendErrorMessage(chatId, err);
    }
};

const handleSummary = async (chatId, action) => {
    try {
        console.log('Handling summary action:', action);
        const url = new URL(process.env.WEBHOOK_URL_V2);
        if (action === 'totalExpense') {
            url.searchParams.append('action', 'getMonthlyTotal');
        } else if (action === 'totalIncome') {
            url.searchParams.append('action', 'getMonthlyIncome');
        } else if (action === 'totalRemaining') {
            const expenseUrl = new URL(process.env.WEBHOOK_URL_V2);
            expenseUrl.searchParams.append('action', 'getMonthlyTotal');
            const incomeUrl = new URL(process.env.WEBHOOK_URL_V2);
            incomeUrl.searchParams.append('action', 'getMonthlyIncome');

            const [expenseData, incomeData] = await Promise.all([callApi(expenseUrl), callApi(incomeUrl)]);

            console.log('Total Remaining Responses:', { expenseData, incomeData });
            if (
                expenseData.status === 'success' &&
                incomeData.status === 'success' &&
                typeof expenseData.total === 'number' &&
                typeof incomeData.total === 'number'
            ) {
                const remaining = incomeData.total - expenseData.total;
                bot.sendMessage(
                    chatId,
                    `💰 *Tổng tiền còn lại tháng ${new Date().getMonth() + 1}:*\n\n📈 *Tổng thu*: ${incomeData.total.toLocaleString('vi-VN')} VND\n📉 *Tổng chi*: ${expenseData.total.toLocaleString('vi-VN')} VND\n💵 *Số tiền còn lại*: ${remaining.toLocaleString('vi-VN')} VND`,
                    { parse_mode: 'Markdown' }
                );
                return;
            } else {
                throw new Error('Invalid response data');
            }
        }

        const data = await callApi(url);
        console.log('Summary Response:', data);
        if (data.status === 'success' && typeof data.total === 'number') {
            const total = data.total.toLocaleString('vi-VN');
            const message =
                action === 'totalExpense'
                    ? `📉 *Tổng chi tiêu tháng ${new Date().getMonth() + 1}:*\n💵 ${total} VND`
                    : `📈 *Tổng thu nhập tháng ${new Date().getMonth() + 1}:*\n💵 ${total} VND`;
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
            throw new Error('Invalid response data');
        }
    } catch (err) {
        sendErrorMessage(chatId, err);
    }
};

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;
    console.log('Callback query received:', { chatId, action });

    if (action === 'deleteAllData') {
        try {
            const url = new URL(process.env.WEBHOOK_URL_V2);
            url.searchParams.append('action', 'deleteAllData');

            const data = await callApi(url);
            console.log('Delete All Data Response:', data);
            if (data.status === 'success') {
                bot.sendMessage(chatId, '🗑️ *Dữ liệu đã được xóa thành công!* 🚀', { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, `❌ Không thể xóa dữ liệu. Phản hồi từ server: *${data.message || 'Unknown error'}*`, { parse_mode: 'Markdown' });
            }
        } catch (err) {
            sendErrorMessage(chatId, err);
        }
    } else {
        handleSummary(chatId, action);
    }
});

bot.onText(/(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1].trim();
    console.log('User message:', text);

    const expenseRegex = /^([\d,.]+(?:k|K|triệu|TRIỆU)?\s+.+)$/;
    const incomeRegex = /^\+([\d,.]+(?:k|K|triệu|TRIỆU)?\s+.+)$/;
    const totalExpenseRegex = /^tổng chi$/i;
    const totalIncomeRegex = /^tổng thu$/i;
    const totalRemainingRegex = /^tổng còn lại$/i;

    if (text === '/start') {
        return;
    }

    if (totalExpenseRegex.test(text)) {
        console.log('Handling total expense request');
        handleSummary(chatId, 'totalExpense');
    } else if (totalIncomeRegex.test(text)) {
        console.log('Handling total income request');
        handleSummary(chatId, 'totalIncome');
    } else if (totalRemainingRegex.test(text)) {
        console.log('Handling total remaining request');
        handleSummary(chatId, 'totalRemaining');
    } else if (expenseRegex.test(text)) {
        console.log('Handling expense transaction');
        const [, details] = text.match(expenseRegex);
        const [amount, ...noteParts] = details.split(' ');
        const note = noteParts.join(' ');
        const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        handleTransaction(chatId, 'Tiền ra', parseAmount(amount), note, timestamp);
    } else if (incomeRegex.test(text)) {
        console.log('Handling income transaction');
        const [, details] = text.match(incomeRegex);
        const [amount, ...noteParts] = details.split(' ');
        const note = noteParts.join(' ');
        const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        handleTransaction(chatId, 'Tiền vào', parseAmount(amount), note, timestamp);
    } else {
        console.log('Invalid user message');
        bot.sendMessage(
            chatId,
            '❌ *Cú pháp không hợp lệ!*\n\n📝 *Ví dụ:*\n- `15k ăn sáng` (tiền ra)\n- `+7triệu tiền lương` (tiền vào)\n- `tổng chi` (tính tổng chi tiêu)\n- `tổng thu` (tính tổng thu nhập)\n- `tổng còn lại` (tính tổng số tiền còn lại)',
            { parse_mode: 'Markdown' }
        );
    }
});

console.log('Bot is running...');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    console.log('Health check received');
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
