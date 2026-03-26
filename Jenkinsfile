pipeline {
    agent { label 'server' }

    options {
        buildDiscarder(logRotator(daysToKeepStr: '10', numToKeepStr: '5', artifactNumToKeepStr: '1'))
        timeout(time: 1, unit: 'HOURS')
        disableConcurrentBuilds()
        skipStagesAfterUnstable()
    }

    environment {
        DOCKER_IMAGE = 'kamdigisdocker/yocoach-front'
        IMAGE_TAG = 'integ'
        SERVICE_NAME = 'yocoach-front'
        USER_CREDENTIALS= credentials('jenkins-docker')
        VPS_USER = credentials('integration-vps')
        VPS_IP = '54.38.35.221'
    }

    stages {
        stage('Build docker image') {
            steps {
                sh 'docker build -t $DOCKER_IMAGE:$IMAGE_TAG .'
            }
        }
        stage('Push docker image') {
            steps {
                sh "docker login -u ${USER_CREDENTIALS_USR} -p ${USER_CREDENTIALS_PSW} docker.io"
                sh 'docker push $DOCKER_IMAGE:$IMAGE_TAG'
            }
        }
        stage('Perform Service Update') {
            steps {
                sshCommand remote: [
                  name: 'remote-vm',
                  host: "${VPS_IP}",
                  user: "${VPS_USER_USR}",
                  password : "${VPS_USER_PSW}",
                  allowAnyHosts: true
                ], command: """
                  cd workspace-yocoach && sudo docker-compose pull ${SERVICE_NAME} && sudo docker-compose down ${SERVICE_NAME} && sudo docker-compose up -d ${SERVICE_NAME}
                """
            }
        }
    }
}
