FROM php:8.3-cli-alpine

# Install system dependencies, PHP extensions, and AWS RDS SSL certificate bundle
RUN apk add --no-cache \
    git \
    curl \
    bash \
    ca-certificates \
    nodejs \
    npm \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    mysql-client \
    mariadb-connector-c \
    linux-headers \
    && update-ca-certificates \
    && curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /etc/ssl/certs/global-bundle.pem \
    && chmod 644 /etc/ssl/certs/global-bundle.pem

RUN npm install -g pnpm
RUN docker-php-ext-install pdo pdo_mysql opcache bcmath

# Install Composer from official image
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy application files
COPY . .

# Build Arguments for Next.js frontend build
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production

# Install PHP dependencies without dev packages
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Install Node dependencies with locked manifest & build Next.js frontend
RUN pnpm install --frozen-lockfile && pnpm run build

# Prepare storage directories with secure permissions (chmod 775, no 777)
RUN mkdir -p storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Setup entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000 3000

ENTRYPOINT ["docker-entrypoint.sh"]
