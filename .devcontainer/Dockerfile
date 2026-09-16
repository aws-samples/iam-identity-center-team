FROM mcr.microsoft.com/devcontainers/base:noble
RUN apt-get update && apt-get install -y --fix-missing apt-transport-https ca-certificates curl gnupg python3 python3-pip python3-venv git-credential-oauth
RUN apt-get install -y iputils-ping dnsutils libglib2.0-bin libnss3 libdbus-1-3 libatk1.0-dev libatk-bridge2.0-dev 
RUN apt-get install -y libcups2-dev libxkbcommon-dev libxcomposite-dev xserver-xorg libpango-1.0-0 libasound2-dev
RUN install -m 0755 -d /etc/apt/keyrings
RUN curl -fsSL https://get.opentofu.org/opentofu.gpg | sudo tee /etc/apt/keyrings/opentofu.gpg >/dev/null
RUN curl -fsSL https://packages.opentofu.org/opentofu/tofu/gpgkey | sudo gpg --no-tty --batch --dearmor -o /etc/apt/keyrings/opentofu-repo.gpg >/dev/null
RUN chmod a+r /etc/apt/keyrings/opentofu.gpg /etc/apt/keyrings/opentofu-repo.gpg
RUN echo \
  "deb [signed-by=/etc/apt/keyrings/opentofu.gpg,/etc/apt/keyrings/opentofu-repo.gpg] https://packages.opentofu.org/opentofu/tofu/any/ any main \
 deb-src [signed-by=/etc/apt/keyrings/opentofu.gpg,/etc/apt/keyrings/opentofu-repo.gpg] https://packages.opentofu.org/opentofu/tofu/any/ any main" | \
  sudo tee /etc/apt/sources.list.d/opentofu.list > /dev/null
RUN chmod a+r /etc/apt/sources.list.d/opentofu.list
RUN apt-get update
RUN apt-get install -y tofu
# Add the Terramate repo to your sources
RUN echo "deb [trusted=yes] https://repo.terramate.io/apt/ /" \
  | sudo tee /etc/apt/sources.list.d/terramate.list

RUN apt update
RUN apt install terramate

RUN python3 -m pip install --break-system-packages "packaging>=26" && \
    python3 -m pip install --break-system-packages pipx boto3 sslib pillow qrcode pyotp cryptography
RUN python3 -m pipx ensurepath
RUN python3 -m pipx install --global aws-sso-util

RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "arm64" ]; then \
      curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"; \
    else \
      curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"; \
    fi
RUN unzip awscliv2.zip
RUN ./aws/install

RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "arm64" ]; then \
      curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_arm64/session-manager-plugin.deb" -o "session-manager-plugin.deb"; \
    else \
      curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb"; \
    fi
RUN dpkg -i session-manager-plugin.deb

RUN apt-get update && apt-get install -y gnupg software-properties-common
RUN wget -O- https://apt.releases.hashicorp.com/gpg | \
gpg --dearmor | \
tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
RUN echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
tee /etc/apt/sources.list.d/hashicorp.list
RUN apt update
RUN apt-get install terraform packer

RUN echo "[safe]\n\
directory = /workspaces/io.idnow.infrastructure.common\n\
\n\
[credential \"https://gitlab.eu.idnow.group\"]\n\
        helper = cache --timeout 21600\n\
        helper = oauth\n\
        oauthClientId = 291489010cb303bdfbd5c4929f6225be95ed38fde423c0282967fb9a43c680a5\n\
        oauthScopes = read_repository write_repository\n\
        oauthAuthURL = /oauth/authorize\n\
        oauthTokenURL = /oauth/token\n\
        oauthDeviceAuthURL = /oauth/authorize_device" > /etc/gitconfig

RUN ARCH=$(dpkg --print-architecture) && \
    PROVIDER=aws && \
    TERRAFORMER_VERSION=$(curl -s https://api.github.com/repos/GoogleCloudPlatform/terraformer/releases/latest | grep tag_name | cut -d '"' -f 4) && \
    curl -LO "https://github.com/GoogleCloudPlatform/terraformer/releases/download/${TERRAFORMER_VERSION}/terraformer-${PROVIDER}-linux-${ARCH}" && \
    chmod +x "terraformer-${PROVIDER}-linux-${ARCH}" && \
    mv "terraformer-${PROVIDER}-linux-${ARCH}" /usr/local/bin/terraformer

ENV NVM_DIR=/usr/local/nvm
RUN mkdir -p $NVM_DIR \
 && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# 4. Install Node 24 and expose its binaries system-wide
RUN bash -c "source $NVM_DIR/nvm.sh \
 && nvm install 24 \
 && nvm alias default 24 \
 && ln -s $NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node)/bin/node /usr/local/bin/node \
 && ln -s $NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node)/bin/npm  /usr/local/bin/npm \
 && npm install -g @anthropic-ai/claude-code"

# 5. Auto-load NVM in every interactive shell for every user
RUN echo 'export NVM_DIR=/usr/local/nvm'          >  /etc/profile.d/nvm.sh \
 && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> /etc/profile.d/nvm.sh