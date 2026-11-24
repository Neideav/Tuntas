FROM php:8.3-fpm-alpine

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
    oniguruma-dev \
    util-linux \
    supervisor \
    linux-headers \
    && update-ca-certificates \
    && curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /etc/ssl/certs/global-bundle.pem \
    && chmod 644 /etc/ssl/certs/global-bundle.pem

RUN npm install -g pnpm
RUN docker-php-ext-install pdo pdo_mysql opcache bcmath mbstring pcntl

# Install Composer from official image
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy application files
COPY . .

# Copy PHP-FPM & Supervisor configuration files
COPY docker/php/php-fpm.d/www.conf /usr/local/etc/php-fpm.d/zz-docker.conf
COPY docker/php/conf.d/custom.ini /usr/local/etc/php/conf.d/custom.ini
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/scheduler-daemon.sh /usr/local/bin/scheduler-daemon.sh
COPY docker/queue-worker-daemon.sh /usr/local/bin/queue-worker-daemon.sh
COPY docker/container-healthcheck.sh /usr/local/bin/container-healthcheck.sh
RUN chmod +x /usr/local/bin/scheduler-daemon.sh \
             /usr/local/bin/queue-worker-daemon.sh \
             /usr/local/bin/container-healthcheck.sh

# Build Arguments for Next.js frontend build (defaults to relative /api/v1)
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Install PHP dependencies without dev packages
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Install Node dependencies with locked manifest, build Next.js frontend, then prune devDependencies
RUN pnpm install --frozen-lockfile \
    && pnpm run build \
    && pnpm prune --prod

# Prepare storage directories with secure permissions (chmod 775, no 777)
RUN mkdir -p storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Setup entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 9000 3000

ENTRYPOINT ["docker-entrypoint.sh"]
