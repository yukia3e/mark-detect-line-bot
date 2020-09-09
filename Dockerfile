FROM node:8

WORKDIR /app

# basic utilities
RUN apt-get update && apt-get -y install git zip unzip vim wget tar locales

# timezone and locale
RUN locale-gen ja_JP.UTF-8
ENV LANG ja_JP.UTF-8
ENV LC_CTYPE ja_JP.UTF-8
RUN localedef -f UTF-8 -i ja_JP ja_JP.utf8
RUN rm -f /etc/localtime
RUN ln -fs /usr/share/zoneinfo/Asia/Tokyo /etc/localtime

RUN curl --compressed -o- -L https://yarnpkg.com/install.sh | bash
ENV PATH $HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH

RUN yarn global add firebase-tools

ENV HOST 0.0.0.0
#EXPOSE 5000
EXPOSE 9005

CMD ["/bin/bash"]
