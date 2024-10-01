import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import './App.css';

const WEBSOCKET_URL = 'wss://stream.binance.com:9443/ws/';
const COINS = ['ETHUSDT', 'BNBUSDT', 'DOTUSDT'];
const INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];
const PING_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds

function App() {
  const [selectedCoin, setSelectedCoin] = useState(COINS[0]);
  const [selectedInterval, setSelectedInterval] = useState(INTERVALS[0]);
  const [candleData, setCandleData] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  const chartContainerRef = useRef();
  const chartInstanceRef = useRef(null);
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsConnecting(true);

    const ws = new WebSocket(`${WEBSOCKET_URL}${selectedCoin.toLowerCase()}@kline_${selectedInterval}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnecting(false);

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.e === 'kline') {
        const candle = data.k;
        const newCandle = {
          time: candle.t / 1000,
          open: parseFloat(candle.o),
          high: parseFloat(candle.h),
          low: parseFloat(candle.l),
          close: parseFloat(candle.c),
        };

        setCandleData((prevData) => {
          const updatedData = { ...prevData };
          if (!updatedData[selectedCoin]) {
            updatedData[selectedCoin] = [];
          }
          
          const pairData = updatedData[selectedCoin];
          const existingCandleIndex = pairData.findIndex(
            (item) => item.time === newCandle.time
          );

          if (existingCandleIndex !== -1) {
            pairData[existingCandleIndex] = newCandle;
          } else {
            pairData.push(newCandle);
          }

          // Keep only the last 100 candles to prevent performance issues
          updatedData[selectedCoin] = pairData.slice(-100);

          return updatedData;
        });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
      setIsConnecting(false);
      clearInterval(pingIntervalRef.current);

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connectWebSocket();
      }, RECONNECT_DELAY);
    };

    wsRef.current = ws;
  }, [selectedCoin, selectedInterval]);

  useEffect(() => {
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        backgroundColor: '#1e222d',
        textColor: '#d9d9d9',
      },
      grid: {
        vertLines: { color: '#2b2b43' },
        horzLines: { color: '#2b2b43' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: {
        borderColor: '#2b2b43',
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartInstanceRef.current = { chart, candlestickSeries };

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      chart.remove();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (chartInstanceRef.current && candleData[selectedCoin] && candleData[selectedCoin].length > 0) {
      chartInstanceRef.current.candlestickSeries.setData(candleData[selectedCoin]);
    }
  }, [candleData, selectedCoin]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Binance Real-time Market Data</h1>
        <div className="controls">
          <div className="select-wrapper">
            <select value={selectedCoin} onChange={(e) => setSelectedCoin(e.target.value)} disabled={isConnecting}>
              {COINS.map((coin) => (
                <option key={coin} value={coin}>{coin}</option>
              ))}
            </select>
          </div>
          <div className="select-wrapper">
            <select value={selectedInterval} onChange={(e) => setSelectedInterval(e.target.value)} disabled={isConnecting}>
              {INTERVALS.map((interval) => (
                <option key={interval} value={interval}>{interval}</option>
              ))}
            </select>
          </div>
        </div>
      </header>
      <main>
        {isConnecting && <div className="loading">Connecting...</div>}
        <div ref={chartContainerRef} className="chart-container" />
      </main>
    </div>
  );
}

export default App;



