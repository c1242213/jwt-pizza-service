#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  exit 1
fi
host=$1

# Function to cleanly exit
cleanup() {
  echo "Terminating background processes..."
  kill $pid1 $pid2 $pid3 $pid4 $pid5 $pid6 $pid7 $pid8 $pid9 $pid10 2>/dev/null
  exit 0
}

# Trap SIGINT (Ctrl+C) to execute the cleanup function
trap cleanup SIGINT

# Simulate a user requesting the menu every 3 seconds
while true; do
  curl -s "$host/api/order/menu" > /dev/null
  echo "Requesting menu..."
  sleep 3
done &
pid1=$!

# Simulate a user with an invalid email and password every 25 seconds
while true; do
  curl -s -X PUT "$host/api/auth" -d '{"email":"unknown@jwt.com", "password":"bad"}' -H 'Content-Type: application/json' > /dev/null
  echo "Logging in with invalid credentials..."
  sleep 25
done &
pid2=$!

# Simulate a franchisee logging in and out every two minutes
while true; do
  response=$(curl -s -X PUT "$host/api/auth" -d '{"email":"f@jwt.com", "password":"franchisee"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo "Login franchisee..."
  sleep 110
  curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
  echo "Logging out franchisee..."
  sleep 10
done &
pid3=$!

# Simulate a diner ordering a pizza every 20 seconds
while true; do
  response=$(curl -s -X PUT "$host/api/auth" -d '{"email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo "Login diner..."
  curl -s -X POST "$host/api/order" -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}' -H "Authorization: Bearer $token" > /dev/null
  echo "Bought a pizza..."
  sleep 20
  curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
  echo "Logging out diner..."
  sleep 30
done &
pid4=$!

# Simulate listing all franchises (unauthenticated) every 10 seconds
while true; do
  curl -s "$host/api/franchise" > /dev/null
  echo "Listing all franchises..."
  sleep 10
done &
pid5=$!

# Simulate franchisee listing their franchises every 30 seconds
while true; do
  response=$(curl -s -X PUT "$host/api/auth" -d '{"email":"f@jwt.com", "password":"franchisee"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  userId=$(echo $response | jq -r '.user.id')
  echo "Login franchisee for listing franchises..."
  curl -s "$host/api/franchise/$userId" -H "Authorization: Bearer $token" > /dev/null
  echo "Listing franchisee franchises for user $userId..."
  sleep 20
  curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
  echo "Logging out franchisee..."
  sleep 10
done &
pid6=$!

# Simulate admin creating and deleting a franchise every 5 minutes
while true; do
  response=$(curl -s -X PUT "$host/api/auth" -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo "Login admin..."
  franchise_response=$(curl -s -X POST "$host/api/franchise" -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d '{"name": "TestFranchise", "admins": [{"email": "f@jwt.com"}]}')
  franchise_id=$(echo $franchise_response | jq -r '.id')
  echo "Created franchise with ID $franchise_id..."
  sleep 270
  curl -s -X DELETE "$host/api/franchise/$franchise_id" -H "Authorization: Bearer $token" > /dev/null
  echo "Deleted franchise with ID $franchise_id..."
  sleep 20
  curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
  echo "Logging out admin..."
  sleep 10
done &
pid7=$!

# Simulate franchisee creating and deleting a store every 3 minutes
while true; do
  response=$(curl -s -X PUT "$host/api/auth" -d '{"email":"f@jwt.com", "password":"franchisee"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo "Login franchisee for store operations..."
  store_response=$(curl -s -X POST "$host/api/franchise/1/store" -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d '{"franchiseId": 1, "name":"TestStore"}')
  store_id=$(echo $store_response | jq -r '.id')
  echo "Created store with ID $store_id in franchise 1..."
  sleep 160
  curl -s -X DELETE "$host/api/franchise/1/store/$store_id" -H "Authorization: Bearer $token" > /dev/null
  echo "Deleted store with ID $store_id from franchise 1..."
  sleep 10
  curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
  echo "Logging out franchisee..."
  sleep 10
done &
pid8=$!

# Simulate admin adding a menu item every 4 minutes
while true; do
  response=$(curl -s -X PUT "$host/api/auth" -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo "Login admin for menu update..."
  curl -s -X PUT "$host/api/order/menu" -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d '{ "title":"Special", "description": "Limited time offer", "image":"special.png", "price": 0.01 }' > /dev/null
  echo "Added special menu item..."
  sleep 230
  curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
  echo "Logging out admin..."
  sleep 10
done &
pid9=$!

# Simulate diner ordering 21 pizzas and checking orders every 6 minutes
while true; do
  response=$(curl -s -X PUT "$host/api/auth" -d '{"email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo "Login diner for bulk order..."

  # Generate 21 pizza items
  items=""
  for i in {1..21}; do
    items="$items{\"menuId\": 1, \"description\": \"Veggie $i\", \"price\": 0.05}"
    [ $i -lt 21 ] && items="$items,"
  done
  order_payload="{\"franchiseId\": 1, \"storeId\": 1, \"items\": [$items]}"
  
  curl -s -X POST "$host/api/order" -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "$order_payload" > /dev/null
  echo "Ordered 21 pizzas..."
  
  sleep 10
  curl -s "$host/api/order" -H "Authorization: Bearer $token" > /dev/null
  echo "Checked diner orders..."
  
  sleep 330
  curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
  echo "Logging out diner..."
  sleep 10
done &
pid10=$!

# Wait for the background processes to complete
wait $pid1 $pid2 $pid3 $pid4 $pid5 $pid6 $pid7 $pid8 $pid9 $pid10