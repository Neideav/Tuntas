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
    sqlite-dev \
    postgresql-dev \
    linux-headers

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN docker-php-ext-install pdo pdo_sqlite pdo_pgsql opcache bcmath

# Install Composer
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy application files
COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Install Node dependencies & build Next.js frontend
RUN pnpm install --frozen-lockfile && pnpm run build

# Prepare storage directories and SQLite database file
RUN mkdir -p storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    database \
    && touch database/database.sqlite \
    && chmod -R 777 storage bootstrap/cache database

EXPOSE 8000 3000

CMD ["sh", "-c", "php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=8000"]

