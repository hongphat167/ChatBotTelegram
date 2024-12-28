import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import 'dotenv/config';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Hàm tiện ích: Xử lý chuyển đổi số tiền
const parseAmount = (amount) => {
    if (amount.toLowerCase().endsWith('k')) {
        return parseFloat(amount.replace('k', '').replace(/,/g, '')) * 1000;
    } else if (amount.toLowerCase().includes('triệu')) {
        return parseFloat(amount.replace('triệu', '').replace(/,/g, '').trim()) * 1000000;
    }
    return parseFloat(amount.replace(/[^\d.]/g, ''));
};

// Hàm tiện ích: Gửi lỗi tới người dùng
const sendErrorMessage = (chatId, error) => {
    console.error('Error:', error);
    bot.sendMessage(chatId, '⚠️ *Oops! Đã có lỗi xảy ra.* Vui lòng thử lại sau nhé! 😢', { parse_mode: 'Markdown' });
};

// Hàm hiển thị Inline Keyboard
const sendInlineKeyboard = (chatId) => {
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

// Hàm tiện ích: Gọi API
const callApi = async (url) => {
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (err) {
        throw new Error('API call failed');
    }
};

// Hàm xử lý giao dịch (Tiền vào/Tiền ra)
const handleTransaction = async (chatId, type, amount, note, timestamp) => {
    const url = new URL(process.env.WEBHOOK_URL);
    url.searchParams.append('amount', amount);
    url.searchParams.append('type', type);
    url.searchParams.append('note', note);
    url.searchParams.append('timestamp', timestamp);

    try {
        const data = await callApi(url);
        if (data.status === 'success') {
            bot.sendMessage(
                chatId,
                `✅ *Ghi nhận thành công!*\n\n📝 *Chi tiết:*\n- 💵 *Số tiền*: ${amount.toLocaleString('vi-VN')} VND\n- 🗂️ *Loại*: ${type}\n- ✍️ *Ghi chú*: ${note}\n- 🕒 *Thời gian*: ${timestamp}`,
                { parse_mode: 'Markdown' }
            );
            sendInlineKeyboard(chatId); // Hiển thị nút bấm sau khi ghi nhận thành công
        } else {
            bot.sendMessage(chatId, `❌ Không thể ghi nhận giao dịch. Phản hồi từ server: *${data.message || 'Unknown error'}*`, { parse_mode: 'Markdown' });
        }
    } catch (err) {
        sendErrorMessage(chatId, err);
    }
};

// Hàm xử lý tổng chi, tổng thu và tổng còn lại
const handleSummary = async (chatId, action) => {
    try {
        const url = new URL(process.env.WEBHOOK_URL_V2);
        if (action === 'totalExpense') {
            url.searchParams.append('action', 'getMonthlyTotal');
            const data = await callApi(url);
            if (data.status === 'success' && typeof data.total === 'number') {
                const total = data.total.toLocaleString('vi-VN');
                bot.sendMessage(chatId, `📉 *Tổng chi tiêu tháng ${new Date().getMonth() + 1}:*\n💵 ${total} VND`, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, `❌ Không thể tính tổng chi tiêu. Phản hồi từ server: *${data.message || 'Unknown error'}*`, { parse_mode: 'Markdown' });
            }
        } else if (action === 'totalIncome') {
            url.searchParams.append('action', 'getMonthlyIncome');
            const data = await callApi(url);
            if (data.status === 'success' && typeof data.total === 'number') {
                const total = data.total.toLocaleString('vi-VN');
                bot.sendMessage(chatId, `📈 *Tổng thu nhập tháng ${new Date().getMonth() + 1}:*\n💵 ${total} VND`, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, `❌ Không thể tính tổng thu nhập. Phản hồi từ server: *${data.message || 'Unknown error'}*`, { parse_mode: 'Markdown' });
            }
        } else if (action === 'totalRemaining') {
            const expenseUrl = new URL(process.env.WEBHOOK_URL_V2);
            expenseUrl.searchParams.append('action', 'getMonthlyTotal');
            const incomeUrl = new URL(process.env.WEBHOOK_URL_V2);
            incomeUrl.searchParams.append('action', 'getMonthlyIncome');

            const [expenseData, incomeData] = await Promise.all([callApi(expenseUrl), callApi(incomeUrl)]);

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
            } else {
                bot.sendMessage(chatId, '❌ Không thể tính tổng số tiền còn lại. Vui lòng kiểm tra dữ liệu từ server.', { parse_mode: 'Markdown' });
            }
        }
    } catch (err) {
        sendErrorMessage(chatId, err);
    }
};

// Xử lý nút bấm
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;

    if (action === 'deleteAllData') {
        try {
            const url = new URL(process.env.WEBHOOK_URL_V2);
            url.searchParams.append('action', 'deleteAllData');

            const data = await callApi(url);

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

// Xử lý lệnh nhập của người dùng
bot.onText(/(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1].trim();

    const expenseRegex = /^([\d,.]+(?:k|K|triệu|TRIỆU)?\s+.+)$/; // Tiền ra
    const incomeRegex = /^\+([\d,.]+(?:k|K|triệu|TRIỆU)?\s+.+)$/; // Tiền vào
    const totalExpenseRegex = /^tổng chi$/i; // Tổng chi
    const totalIncomeRegex = /^tổng thu$/i; // Tổng thu
    const totalRemainingRegex = /^tổng còn lại$/i; // Tổng còn lại

    if (totalExpenseRegex.test(text)) {
        handleSummary(chatId, 'totalExpense');
    } else if (totalIncomeRegex.test(text)) {
        handleSummary(chatId, 'totalIncome');
    } else if (totalRemainingRegex.test(text)) {
        handleSummary(chatId, 'totalRemaining');
    } else if (expenseRegex.test(text)) {
        const [, details] = text.match(expenseRegex);
        const [amount, ...noteParts] = details.split(' ');
        const note = noteParts.join(' ');
        const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        handleTransaction(chatId, 'Tiền ra', parseAmount(amount), note, timestamp);
    } else if (incomeRegex.test(text)) {
        const [, details] = text.match(incomeRegex);
        const [amount, ...noteParts] = details.split(' ');
        const note = noteParts.join(' ');
        const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        handleTransaction(chatId, 'Tiền vào', parseAmount(amount), note, timestamp);
    } else {
        bot.sendMessage(
            chatId,
            '❌ *Cú pháp không hợp lệ!*\n\n📝 *Ví dụ:*\n- `15k ăn sáng` (tiền ra)\n- `+7 triệu tiền lương` (tiền vào)\n- `tổng chi` (tính tổng chi tiêu)\n- `tổng thu` (tính tổng thu nhập)\n- `tổng còn lại` (tính tổng số tiền còn lại)',
            { parse_mode: 'Markdown' }
        );
    }
});

console.log('Bot is running...');
