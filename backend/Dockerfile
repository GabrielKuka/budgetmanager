FROM python:3.8

WORKDIR /app/backend

COPY pyproject.toml ./
COPY uv.lock ./

# Install uv and synchronize dependencies
RUN curl -sSL https://astral.sh/uv/install.sh | sh && \
    uv sync --frozen

COPY . .

EXPOSE 8001

CMD ["uv", "run", "manage.py", "runserver", "0.0.0.0:8001"]