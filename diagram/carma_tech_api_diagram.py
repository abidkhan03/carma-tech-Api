from diagrams import Diagram, Cluster
from diagrams.aws.compute import Lambda
from diagrams.aws.integration import SimpleNotificationServiceSns as SNS
from diagrams.aws.management import Cloudwatch, SystemsManagerParameterStore
from diagrams.onprem.database import MySQL
from diagrams.aws.cost import CostExplorer
from diagrams.onprem.client import User
from diagrams.programming.language import Nodejs

with Diagram("NestJS Project Architecture", show=False, direction="TB"):
    user = User("API Consumer")
    with Cluster("NestJS Application"):
        with Cluster("Modules"):
            auth = Nodejs("Auth Module")
            aws = Nodejs("AWS Module")
            user_module = Nodejs("User Module")
            common_module = Nodejs("Common Module")
            main_module = Nodejs("Main Module")
            
            with Cluster("Auth"):
                auth_controller = Nodejs("AuthController")
                auth_service = Nodejs("AuthService")
            
            with Cluster("AWS"):
                sns_controller = Nodejs("SNSController")
                infra_cost_controller = Nodejs("InfraCostController")
                infra_cost_service = Nodejs("InfraCostService")
            
            with Cluster("User"):
                user_controller = Nodejs("UserController")
                user_service = Nodejs("UserService")
        
        main_ts = Nodejs("main.ts")
        lambda_ts = Nodejs("lambda.ts")
        ddb_table = MySQL("Db")
    
    # AWS Services
    lambda_service = Lambda("Lambda Function")
    sns_service = SNS("SNS Topic")
    cost_explorer = CostExplorer("Cost Explorer")
    
    # Connections
    user >> main_ts >> auth_controller >> auth_service >> [lambda_service, ddb_table]
    user >> sns_controller >> sns_service
    user >> infra_cost_controller >> infra_cost_service >> cost_explorer
    user >> user_controller >> user_service >> ddb_table
    
    auth_service - user_service
    sns_service >> lambda_service
