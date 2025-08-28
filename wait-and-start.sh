# Wait until CouchDB is up and responding
until curl -s "$COUCHDB_URL/_up"; do
  echo "Waiting for CouchDB to be up..."
  sleep 2
done

echo "CouchDB is up!"

# Create databases if they don't exist (ignores if already created)
curl -X PUT "$COUCHDB_URL/_users"
curl -X PUT "$COUCHDB_URL/users"
curl -X PUT "$COUCHDB_URL/logs"

# Now start the app
npm run build
npm start
