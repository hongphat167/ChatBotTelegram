import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import 'dotenv/config';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1].trim();

    // Regex to identify "tiền ra" (e.g., 15k ăn sáng), "tiền vào" (e.g., +7 triệu tiền lương), "tổng chi", and "tổng thu"
    const expenseRegex = /^([\d,.]+[kK]?\s+.+)$/; // Tiền ra
    const incomeRegex = /^\+([\d,.]+(?:k|K|triệu|TRIỆU)?\s+.+)$/; // Tiền vào
    const totalExpenseRegex = /^tổng chi$/i; // Tổng chi
    const totalIncomeRegex = /^tổng thu$/i; // Tổng thu

    if (totalExpenseRegex.test(text)) {
        const url = new URL(process.env.WEBHOOK_URL_V2);
        url.searchParams.append('action', 'getMonthlyTotal');

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && typeof data.total === 'number') {
                    const total = data.total.toLocaleString('vi-VN');
                    bot.sendMessage(chatId, `\u2705 Tổng chi tiêu tháng ${new Date().getMonth() + 1}: ${total} VND`);
                } else {
                    bot.sendMessage(chatId, `Không thể tính tổng chi tiêu. Phản hồi từ server: ${data.message || 'Unknown error'}`);
                }
            })
            .catch(err => {
                console.error('Fetch error:', err);
                bot.sendMessage(chatId, 'Đã có lỗi xảy ra. Vui lòng thử lại sau!');
            });
        return;
    }

    if (totalIncomeRegex.test(text)) {
        const url = new URL(process.env.WEBHOOK_URL_V2);
        url.searchParams.append('action', 'getMonthlyIncome');

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && typeof data.total === 'number') {
                    const total = data.total.toLocaleString('vi-VN');
                    bot.sendMessage(chatId, `\u2705 Tổng thu nhập tháng ${new Date().getMonth() + 1}: ${total} VND`);
                } else {
                    bot.sendMessage(chatId, `Không thể tính tổng thu nhập. Phản hồi từ server: ${data.message || 'Unknown error'}`);
                }
            })
            .catch(err => {
                console.error('Fetch error:', err);
                bot.sendMessage(chatId, 'Đã có lỗi xảy ra. Vui lòng thử lại sau!');
            });
        return;
    }

    let type = '';
    let amount = '';
    let note = '';

    if (expenseRegex.test(text)) {
        type = 'Tiền ra';
        const [, details] = text.match(expenseRegex);
        [amount, ...note] = details.split(' ');
    } else if (incomeRegex.test(text)) {
        type = 'Tiền vào';
        const [, details] = text.match(incomeRegex);
        [amount, ...note] = details.split(' ');
    } else {
        bot.sendMessage(chatId, 'Cú pháp không hợp lệ. Vui lòng thử lại.\n\nVí dụ:\n- `15k ăn sáng` (tiền ra)\n- `+7 triệu tiền lương` (tiền vào)\n- `tổng chi` (tính tổng chi tiêu)\n- `tổng thu` (tính tổng thu nhập)', {
            parse_mode: 'Markdown',
        });
        return;
    }

    // Convert amount to numeric value
    if (amount.toLowerCase().endsWith('k')) {
        amount = parseFloat(amount.replace('k', '').replace(/,/g, '')) * 1000;
    } else if (amount.toLowerCase().includes('triệu')) {
        amount = parseFloat(amount.toLowerCase().replace('triệu', '').replace(/,/g, '').trim()) * 1000000;
    } else {
        amount = parseFloat(amount.replace(/[^\d.]/g, ''));
    }

    note = note.join(' ');
    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    const url = new URL(process.env.WEBHOOK_URL);
    url.searchParams.append('amount', amount);
    url.searchParams.append('type', type);
    url.searchParams.append('note', note);
    url.searchParams.append('timestamp', timestamp);

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                bot.sendMessage(chatId, `\u2705 Đã ghi lại: \n- Số tiền: ${amount.toLocaleString('vi-VN')}\n- Loại: ${type}\n- Ghi chú: ${note}\n- Thời gian: ${timestamp}`);
            } else {
                bot.sendMessage(chatId, `Không thể thêm. Phản hồi từ server: ${data.message || 'Unknown error'}`);
            }
        })
        .catch(err => {
            console.error('Fetch error:', err);
            bot.sendMessage(chatId, 'Đã có lỗi xảy ra. Vui lòng thử lại sau!');
        });
});

console.log('Bot is running...');
