const config = require('./config');
const os = require('os');

class Metrics {
    constructor() {
        this.source = config.metrics.source;
        this.url = config.metrics.url;
        this.apiKey = config.metrics.apiKey;
        console.log('Metrics initialized:', { source: this.source, url: this.url, apiKey: this.apiKey });
        this.requestCounters = new Map();
        this.methodCounters = new Map();
        this.pizzaPurchases = 0;
        this.pizzaRevenue = 0;
        this.failedPizzaPurchases = 0;
        this.activeUsers = new Set();
        this.sendMetricsPeriodically(10000);
    }

    sendMetricToGrafana(metricName, metricValue, type, unit) {
        const metric = {
          resourceMetrics: [
            {
              scopeMetrics: [
                {
                  metrics: [
                    {
                      name: metricName,
                      unit: unit,
                      [type]: {
                        dataPoints: [
                          {
                            asInt: metricValue,
                            timeUnixNano: Date.now() * 1000000,
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        };
      
        if (type === 'sum') {
          metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
          metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
        }
      
        const body = JSON.stringify(metric);
        fetch(`${this.url}`, {
          method: 'POST',
          body: body,
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        })
          .then((response) => {
            if (!response.ok) {
              response.text().then((text) => {
                console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
              });
            } else {
              // console.log(`Pushed ${metricName}`);
            }
          })
          .catch((error) => {
            console.error('Error pushing metrics:', error);
          });
    }


    requestTracker(req, res, next) {
        const start = process.hrtime();
        const method = req.method;
        const route = req.route ? req.route.path : req.originalUrl || req.path;
        const requestKey = `${method}:${route}`;

        // Track active users
        // if (req.headers.authorization) {
        //     const token = req.headers.authorization.split(' ')[1];
        //     this.activeUsers.add(token);
        // }

        // Increment total request counter for this route
        const currentRouteCount = this.requestCounters.get(requestKey) || 0;
        this.requestCounters.set(requestKey, currentRouteCount + 1);

        // Increment method-specific counter
        const currentMethodCount = this.methodCounters.get(method) || 0;
        this.methodCounters.set(method, currentMethodCount + 1);

        // Special handling for pizza orders
        if (method === 'POST' && route === '/api/order') {
          if (req.body && req.body.items) {
              const items = req.body.items;
              const orderTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
              
              res.on('finish', () => {
  
                  if (res.statusCode === 200) {
                      // Successful purchase
                      this.pizzaPurchases += items.length;
                      this.pizzaRevenue += orderTotal;
                      console.log(`Pizza order detected: ${items.length} pizzas, Revenue: ${orderTotal}`);
                  } else {
                      // Failed purchase
                      this.failedPizzaPurchases += items.length;
                      console.log(`Failed pizza order detected: ${items.length} pizzas, Status: ${res.statusCode}`);
                  }
  
                  // ... existing latency metrics ...
  
                  // Send failed purchases metric after each attempt
                  this.sendMetricToGrafana(
                      'pizza_purchases_failed_total',
                      this.failedPizzaPurchases,
                      'sum',
                      '1'
                  );
              });
          } else {
              // Count as failed if no items in order
              res.on('finish', () => {
                  if (res.statusCode !== 200 || !req.body.items) {
                      this.failedPizzaPurchases += 1;
                      console.log('Failed pizza order: No items found in request body');
                      this.sendMetricToGrafana(
                          'pizza_purchases_failed_total',
                          this.failedPizzaPurchases,
                          'sum',
                          '1'
                      );
                  }
              });
              console.log('No items found in /api/order request body:', req.body);
          }
      } else {
          res.on('finish', () => {
              const [seconds, nanoseconds] = process.hrtime(start);
              const latencyMs = (seconds * 1000) + (nanoseconds / 1000000);

              // Send total requests metric (all methods combined for this route)
              this.sendMetricToGrafana(
                  'http_requests_total',
                  this.requestCounters.get(requestKey),
                  'sum',
                  '1'
              );

              // Send method-specific total
              this.sendMetricToGrafana(
                  `http_${method.toLowerCase()}_requests_total`,
                  this.methodCounters.get(method),
                  'sum',
                  '1'
              );

              // Send latency metric
              this.sendMetricToGrafana(
                  'http_request_latency_ms',
                  Math.round(latencyMs),
                  'gauge',
                  'ms'
              );

              // Send pizza order latency
              if (method === 'POST' && route === '/api/order') {
                  this.sendMetricToGrafana(
                      'pizza_order_latency_ms',
                      Math.round(latencyMs),
                      'gauge',
                      'ms'
                  );
              }
          });
        }
        next();
      }

    sendMetricsPeriodically(period) {
      setInterval(() => {
        try {
          const cpuUsage = this.getCpuUsagePercentage();
          const memoryUsage = this.getMemoryUsagePercentage();
          
          this.sendMetricToGrafana('cpu_usage_percentage', Math.round(cpuUsage), 'gauge', '%');
          this.sendMetricToGrafana('memory_usage_percentage', Math.round(memoryUsage), 'gauge', '%');
          
          // Send active users count periodically
          this.sendMetricToGrafana('active_users', this.activeUsers.size, 'gauge', 'users');
    
          // Clear active users every 5 minutes to avoid accumulation
          if (Date.now() % (5 * 60 * 1000) < period) {
            this.activeUsers.clear();
            console.log('Cleared active users set');
          }
    
          this.sendMetricToGrafana('pizza_purchases_total', this.pizzaPurchases, 'sum', '1');
          this.sendMetricToGrafana('pizza_revenue_total', Math.round(this.pizzaRevenue * 100), 'sum', '1');
        } catch (error) {
          console.error('Error sending metrics:', error);
        }
      }, period);
    }


    getCpuUsagePercentage() {
        const cpuUsage = os.loadavg()[0] / os.cpus().length;
        return Number((cpuUsage * 100).toFixed(2));
    }

    getMemoryUsagePercentage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        return Number(((usedMemory / totalMemory) * 100).toFixed(2));
    }
}

module.exports = new Metrics();


// const config = require("./config");
// const os = require("os");

// class Metrics {
//   constructor() {
//     // this.source = config.metrics.source;
//     // this.url = config.metrics.url;
//     // this.apiKey = config.metrics.apiKey;
//     // console.log("Metrics initialized:", {
//     //   source: this.source,
//     //   url: this.url,
//     //   apiKey: this.apiKey,
//     // });
//     // this.requestCounters = new Map();
//     // this.methodCounters = new Map();
//     // this.pizzaPurchases = 0;
//     // this.pizzaRevenue = 0;
//     // this.failedPizzaRequests = 0; // New counter for failed pizza requests
//     // this.activeUsers = new Set();
//     // this.sendMetricsPeriodically(10000);

    


//       this.source = config.metrics.source;
//       this.url = config.metrics.url;
//       this.apiKey = config.metrics.apiKey;
//       console.log('Metrics initialized:', { source: this.source, url: this.url, apiKey: this.apiKey });
//       this.requestCounters = new Map();
//       this.methodCounters = new Map();
//       this.pizzaPurchases = 0;
//       this.pizzaRevenue = 0;
//       this.failedPizzaPurchases = 0;
//       this.activeUsers = new Set();
//       this.sendMetricsPeriodically(10000);
//   }

//   sendMetricToGrafana(metricName, metricValue, type, unit) {
//     const metric = {
//       resourceMetrics: [
//         {
//           scopeMetrics: [
//             {
//               metrics: [
//                 {
//                   name: metricName,
//                   unit: unit,
//                   [type]: {
//                     dataPoints: [
//                       {
//                         asInt: metricValue,
//                         timeUnixNano: Date.now() * 1000000,
//                       },
//                     ],
//                   },
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//     };

//     if (type === "sum") {
//       metric.resourceMetrics[0].scopeMetrics[0].metrics[0][
//         type
//       ].aggregationTemporality = "AGGREGATION_TEMPORALITY_CUMULATIVE";
//       metric.resourceMetrics[0].scopeMetrics[0].metrics[0][
//         type
//       ].isMonotonic = true;
//     }

//     const body = JSON.stringify(metric);
//     fetch(`${this.url}`, {
//       method: "POST",
//       body: body,
//       headers: {
//         Authorization: `Bearer ${this.apiKey}`,
//         "Content-Type": "application/json",
//       },
//     })
//       .then((response) => {
//         if (!response.ok) {
//           response.text().then((text) => {
//             console.error(
//               `Failed to push metrics data to Grafana: ${text}\n${body}`
//             );
//           });
//         } else {
//           console.log(`Pushed ${metricName}`);
//         }
//       })
//       .catch((error) => {
//         console.error("Error pushing metrics:", error);
//       });
//   }

//   requestTracker(req, res, next) {
//     const start = process.hrtime();
//     const method = req.method;
//     const route = req.route ? req.route.path : req.originalUrl || req.path;
//     const requestKey = `${method}:${route}`;

//     if (req.headers.authorization) {
//       const token = req.headers.authorization.split(" ")[1];
//       this.activeUsers.add(token);
//     }

//     const currentRouteCount = this.requestCounters.get(requestKey) || 0;
//     this.requestCounters.set(requestKey, currentRouteCount + 1);

//     const currentMethodCount = this.methodCounters.get(method) || 0;
//     this.methodCounters.set(method, currentMethodCount + 1);

//     if (method === "POST" && route === "/api/order") {
//       if (req.body && req.body.items) {
//         const items = req.body.items;
//         const orderTotal = items.reduce(
//           (sum, item) => sum + (item.price || 0),
//           0
//         );
//         this.pizzaPurchases += items.length;
//         this.pizzaRevenue += orderTotal;
//         console.log(
//           `Pizza order detected: ${items.length} pizzas, Revenue: ${orderTotal}`
//         );
//       } else {
//         this.failedPizzaRequests += 1; // Increment failed pizza requests
//         console.log(
//           "Failed pizza order - No items found in /api/order request body:",
//           req.body
//         );
//       }
//     }

//     res.on("finish", () => {
//       const [seconds, nanoseconds] = process.hrtime(start);
//       const latencyMs = seconds * 1000 + nanoseconds / 1000000;

//       this.sendMetricToGrafana(
//         "http_requests_total",
//         this.requestCounters.get(requestKey),
//         "sum",
//         "1"
//       );

//       this.sendMetricToGrafana(
//         `http_${method.toLowerCase()}_requests_total`,
//         this.methodCounters.get(method),
//         "sum",
//         "1"
//       );

//       this.sendMetricToGrafana(
//         "http_request_latency_ms",
//         Math.round(latencyMs),
//         "gauge",
//         "ms"
//       );

//       if (method === "POST" && route === "/api/order") {
//         this.sendMetricToGrafana(
//           "pizza_order_latency_ms",
//           Math.round(latencyMs),
//           "gauge",
//           "ms"
//         );
//       }
//     });

//     next();
//   }

//   // sendMetricsPeriodically(period) {
//   //   setInterval(() => {
//   //     try {
//   //       const cpuUsage = this.getCpuUsagePercentage();
//   //       const memoryUsage = this.getMemoryUsagePercentage();

//   //       this.sendMetricToGrafana(
//   //         "cpu_usage_percentage",
//   //         Math.round(cpuUsage),
//   //         "gauge",
//   //         "%"
//   //       );
//   //       this.sendMetricToGrafana(
//   //         "memory_usage_percentage",
//   //         Math.round(memoryUsage),
//   //         "gauge",
//   //         "%"
//   //       );
//   //       this.sendMetricToGrafana(
//   //         "active_users",
//   //         this.activeUsers.size,
//   //         "gauge",
//   //         "users"
//   //       );
//   //       this.sendMetricToGrafana(
//   //         "pizza_purchases_total",
//   //         this.pizzaPurchases,
//   //         "sum",
//   //         "1"
//   //       );
//   //       this.sendMetricToGrafana(
//   //         "pizza_revenue_total",
//   //         Math.round(this.pizzaRevenue * 100),
//   //         "sum",
//   //         "1"
//   //       );

//   //       // Add failed pizza requests metric
//   //       this.sendMetricToGrafana(
//   //         "pizza_failed_requests_total",
//   //         this.failedPizzaRequests,
//   //         "sum",
//   //         "1"
//   //       );
//   //     } catch (error) {
//   //       console.error("Error sending metrics:", error);
//   //     }
//   //   }, period);
//   // }

//   sendMetricsPeriodically(period) {
//     setInterval(() => {
//       try {
//         const cpuUsage = this.getCpuUsagePercentage();
//         const memoryUsage = this.getMemoryUsagePercentage();

//         this.sendMetricToGrafana(
//           "cpu_usage_percentage",
//           Math.round(cpuUsage),
//           "gauge",
//           "%"
//         );
//         this.sendMetricToGrafana(
//           "memory_usage_percentage",
//           Math.round(memoryUsage),
//           "gauge",
//           "%"
//         );

//         // Send active users count periodically
//         this.sendMetricToGrafana(
//           "active_users",
//           this.activeUsers.size,
//           "gauge",
//           "users"
//         );

//         // Clear active users every 5 minutes to avoid accumulation
//         if (Date.now() % (5 * 60 * 1000) < period) {
//           this.activeUsers.clear();
//           console.log("Cleared active users set");
//         }

//         //Add failed pizza requests metric
//         this.sendMetricToGrafana(
//           "pizza_failed_requests_total",
//           this.failedPizzaRequests,
//           "sum",
//           "1"
//         );

//         this.sendMetricToGrafana(
//           "pizza_purchases_total",
//           this.pizzaPurchases,
//           "sum",
//           "1"
//         );
//         this.sendMetricToGrafana(
//           "pizza_revenue_total",
//           Math.round(this.pizzaRevenue * 100),
//           "sum",
//           "1"
//         );
//       } catch (error) {
//         console.error("Error sending metrics:", error);
//       }
//     }, period);
//   }

//   getCpuUsagePercentage() {
//     const cpuUsage = os.loadavg()[0] / os.cpus().length;
//     return Number((cpuUsage * 100).toFixed(2));
//   }

//   getMemoryUsagePercentage() {
//     const totalMemory = os.totalmem();
//     const freeMemory = os.freemem();
//     const usedMemory = totalMemory - freeMemory;
//     return Number(((usedMemory / totalMemory) * 100).toFixed(2));
//   }
// }

// module.exports = new Metrics();
