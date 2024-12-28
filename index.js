import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import 'dotenv/config';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1].trim();

    // Regex to identify commands
    const expenseRegex = /^([\d,.]+(?:k|K|triệu|TRIỆU)?\s+.+)$/; // Tiền ra
    const incomeRegex = /^\+([\d,.]+(?:k|K|triệu|TRIỆU)?\s+.+)$/; // Tiền vào
    const totalExpenseRegex = /^tổng chi$/i; // Tổng chi
    const totalIncomeRegex = /^tổng thu$/i; // Tổng thu
    const totalRemainingRegex = /^tổng còn lại$/i; // Tổng còn lại

    // Handle "tổng chi"
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

    // Handle "tổng thu"
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

    // Handle "tổng còn lại"
    if (totalRemainingRegex.test(text)) {
        const expenseUrl = new URL(process.env.WEBHOOK_URL_V2);
        expenseUrl.searchParams.append('action', 'getMonthlyTotal');

        const incomeUrl = new URL(process.env.WEBHOOK_URL_V2);
        incomeUrl.searchParams.append('action', 'getMonthlyIncome');

        Promise.all([
            fetch(expenseUrl).then(res => res.json()),
            fetch(incomeUrl).then(res => res.json())
        ])
            .then(([expenseData, incomeData]) => {
                if (
                    expenseData.status === 'success' &&
                    incomeData.status === 'success' &&
                    typeof expenseData.total === 'number' &&
                    typeof incomeData.total === 'number'
                ) {
                    const remaining = incomeData.total - expenseData.total;
                    bot.sendMessage(
                        chatId,
                        `\u2705 Tổng số tiền còn lại tháng ${new Date().getMonth() + 1}:\n- Tổng thu: ${incomeData.total.toLocaleString('vi-VN')} VND\n- Tổng chi: ${expenseData.total.toLocaleString('vi-VN')} VND\n- Số tiền còn lại: ${remaining.toLocaleString('vi-VN')} VND`
                    );
                } else {
                    bot.sendMessage(chatId, 'Không thể tính tổng số tiền còn lại. Vui lòng kiểm tra lại dữ liệu từ server.');
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
        bot.sendMessage(
            chatId,
            'Cú pháp không hợp lệ. Vui lòng thử lại.\n\nVí dụ:\n- `15k ăn sáng` (tiền ra)\n- `+7 triệu tiền lương` (tiền vào)\n- `tổng chi` (tính tổng chi tiêu)\n- `tổng thu` (tính tổng thu nhập)\n- `tổng còn lại` (tính tổng số tiền còn lại)',
            { parse_mode: 'Markdown' }
        );
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
                bot.sendMessage(
                    chatId,
                    `\u2705 Đã ghi lại: \n- Số tiền: ${amount.toLocaleString('vi-VN')}\n- Loại: ${type}\n- Ghi chú: ${note}\n- Thời gian: ${timestamp}`
                );
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
