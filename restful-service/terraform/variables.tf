variable "project_id" {
  type = string
  default = "combined-genai-bi"
}

variable "deployment_region" {
  type = string
  default = "us-central1"
}

variable "docker_image" {
    type = string
    default = "us-central1-docker.pkg.dev/combined-genai-bi/dashboard-summarization-docker-repo/restfulserviceimage"
}

variable "cloud_run_service_name" {
    type = string
    default = "restful-service"
}
