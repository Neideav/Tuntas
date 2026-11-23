FROM php:8.3-cli-alpine

# Install system dependencies and PHP extensions
RUN apk add --no-cache \
    git \
    curl \
    nodejs \
    npm \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    mysql-client \
    linux-headers

RUN npm install -g pnpm
RUN docker-php-ext-install pdo pdo_mysql opcache bcmath

# Install Composer
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy application files
COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Install Node dependencies & build Next.js frontend
RUN pnpm install --frozen-lockfile && pnpm run build

# Prepare storage directories
RUN mkdir -p storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache

# Setup entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000 3000

ENTRYPOINT ["docker-entrypoint.sh"]
