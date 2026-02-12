# Use a lightweight Nginx server
FROM nginx:alpine

# Copy our simple HTML file to the server
COPY index.html /usr/share/nginx/html/index.html

# Cloud Run expects us to listen on port 8080, but Nginx listens on 80 by default.
# We need to configure Nginx to listen on the port Google gives us ($PORT).
# For this simple test, we will just force Nginx to listen on 8080.
RUN sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf

# Expose the port
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]