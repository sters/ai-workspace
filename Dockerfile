FROM node:20-bookworm

# Install system deps: git, gh, Go, and Google Cloud SDK
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  git \
  gh \
  golang-go \
  gnupg \
  ca-certificates \
  && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list \
  && curl -sSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-cloud-cli \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install Bun (system-wide; pin version to reduce supply-chain risk)
ENV BUN_INSTALL=/usr/local/bun
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.1.38"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# npm is available from the node image; install global CLI
RUN npm install -g @anthropic-ai/claude-code

# dev can sudo without password (convenience in isolated container only; do not expose this image to untrusted users)
RUN useradd -m -s /bin/bash dev && \
  echo "dev ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

USER dev
WORKDIR /ai-workspace

ENTRYPOINT ["/home/dev/bin/entrypoint.sh"]
