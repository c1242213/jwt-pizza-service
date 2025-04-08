## fix permissions

#### change ownership 
sudo chown -R _mysql:_mysql /usr/local/mysql-9.2.0-macos15-arm64/data

#### set permissions
sudo chmod -R 755 /usr/local/mysql-9.2.0-macos15-arm64/data

### verify
ls -ld /usr/local/mysql-9.2.0-macos15-arm64/data
ls -l /usr/local/mysql-9.2.0-macos15-arm64/data

## Start mysql again
sudo /usr/local/mysql-9.2.0-macos15-arm64/bin/mysqld_safe --user=_mysql &