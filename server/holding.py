from nsepython import nse_get_most_active_stocks

# Get most active stocks (by volume)
active_stocks = nse_get_most_active_stocks()

print("Most Traded Stocks (by volume):")
for stock in active_stocks[:10]:
    print(f"{stock['symbol']} - Volume: {stock['tradedQuantity']}")
