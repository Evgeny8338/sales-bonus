/**
 * Функция для расчета прибыли
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;
    
    // Рассчитываем множитель скидки (остаток суммы без скидки)
    const discountMultiplier = 1 - (purchase.discount / 100);

    // Рассчитываем выручку: цена продажи × количество × множитель скидки
    const revenue = purchase.sale_price * purchase.quantity * discountMultiplier;

    // Возвращаем выручку
    return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    
    // Определяем позицию в рейтинге (индекс 0 = 1-е место)
    const position = index + 1;

    // Применяем правила начисления бонусов
    if (position === 1) {
        return seller.profit * 0.15;  // 15% для первого места
    } else if (position === 2 || position === 3) {
        return seller.profit * 0.10;  // 10% для второго и третьего
    } else if (position === total) {
        return 0;  // 0% для последнего места
    } else {
        return seller.profit * 0.05;  // 5% для остальных
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */

// Главная функция анализа данных
function analyzeSalesData(data, options) {
    // 1. Проверка входных данных
    if (!data
        || !Array.isArray(data.purchase_records)
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || data.purchase_records.length === 0
        || data.sellers.length === 0
        || data.products.length === 0
    ) {
        throw new Error("Некорректные входные данные");
    }

    // 2. Проверка наличия опций и функций расчета
    const { calculateRevenue, calculateBonus } = options;
    if (!calculateRevenue || !calculateBonus
        || typeof calculateRevenue !== 'function'
        || typeof calculateBonus !== 'function'
    ) {
        throw new Error("Не переданы обязательные функции расчета");
    }

    // 3. Подготовка структуры для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        first_name: seller.first_name,
        last_name: seller.last_name,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // 4. Создание индексов для быстрого доступа
    const sellerIndex = sellerStats.reduce((acc, seller) => {
        acc[seller.id] = seller;
        return acc;
    }, {});

    const productIndex = data.products.reduce((acc, product) => {
        acc[product.sku] = product;
        return acc;
    }, {});

    // 5. Обработка записей о покупках с округлением
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];

        if (!seller) return; // Пропускаем неизвестных продавцов

        // Обновляем счетчик продаж
        seller.sales_count += 1;

        // Обрабатываем каждый товар в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return;

            // Рассчитываем выручку для товара
            const itemRevenue = calculateRevenue(item, product);

            // Рассчитываем себестоимость
            const itemCost = Math.round(product.purchase_price * item.quantity * 100) / 100;

            // Рассчитываем прибыль
            const itemProfit = itemRevenue - itemCost

            // Обновляем прибыль продавца
            seller.revenue = Math.round((seller.revenue + itemRevenue) * 100) / 100;
            seller.profit = seller.profit + itemProfit

            // Обновляем счетчик товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // 6. Сортировка продавцов по прибыли (убывание)
    const sortedSellers = [...sellerStats].sort((a, b) => b.profit - a.profit);
    const totalSellers = sortedSellers.length;

    // 7. Расчет бонусов
    sortedSellers.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, totalSellers, seller);
    });

    // 8. Формирование итогового результата
    return sortedSellers.map(seller => {
        // Преобразуем объект товаров в массив и сортируем
        const topProducts = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        return {
            seller_id: seller.id,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: +(seller.revenue.toFixed(2)),
            profit: +(seller.profit.toFixed(2)),
            sales_count: seller.sales_count,
            top_products: topProducts,
            bonus: +(seller.bonus.toFixed(2))
        };
    });
}