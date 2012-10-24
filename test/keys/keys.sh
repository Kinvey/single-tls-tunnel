rm *.pem
openssl genrsa -out client-key.pem 1024
openssl req -new -key client-key.pem -config cert-request.cnf -out client-csr.pem
openssl x509 -req -in client-csr.pem -signkey client-key.pem -out client-cert.pem
openssl genrsa -out server-key.pem 1024
openssl req -new -key server-key.pem -config cert-request.cnf -out server-csr.pem
openssl x509 -req -in server-csr.pem -signkey server-key.pem -out server-cert.pem -extensions v3_ca -extfile extensions.cnf
