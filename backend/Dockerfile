FROM python:3.8

WORKDIR /app/backend

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sSL https://astral.sh/uv/install.sh | sh

ENV PATH="/root/.cargo/bin:${PATH}"

COPY pyproject.toml uv.lock ./

RUN rm -rf .venv

RUN uv sync --frozen

COPY . .

EXPOSE 8001

CMD ["uv", "run", "manage.py", "runserver", "0.0.0.0:8001"]
